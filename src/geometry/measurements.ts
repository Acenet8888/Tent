import type { PoleJoint, PoleSegment, Vector3 } from "../types/tent";

export function calculateDistance(a: Vector3, b: Vector3): number {
  return Math.sqrt(
    Math.pow(b.x - a.x, 2) + Math.pow(b.y - a.y, 2) + Math.pow(b.z - a.z, 2)
  );
}

export function subtract(a: Vector3, b: Vector3): Vector3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

export function add(a: Vector3, b: Vector3): Vector3 {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

export function scale(a: Vector3, s: number): Vector3 {
  return { x: a.x * s, y: a.y * s, z: a.z * s };
}

export function midpoint(a: Vector3, b: Vector3): Vector3 {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2 };
}

/**
 * The control point of a quadratic Bezier that passes exactly through
 * `apex` at t=0.5 (a plain quadratic Bezier only touches its start/end
 * points, not its control point, so we solve for the control point that
 * forces the curve through the peak instead of just bulging toward it).
 * B(0.5) = 0.25*start + 0.5*control + 0.25*end = apex
 *   => control = 2*apex - 0.5*(start+end)
 */
export function computeArcControlPoint(start: Vector3, apex: Vector3, end: Vector3): Vector3 {
  return subtract(scale(apex, 2), scale(add(start, end), 0.5));
}

/** Samples a hoop's ground → peak → ground curve into a polyline for rendering/length. */
export function sampleArc(start: Vector3, apex: Vector3, end: Vector3, steps = 16): Vector3[] {
  const control = computeArcControlPoint(start, apex, end);
  const points: Vector3[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const mt = 1 - t;
    points.push(
      add(add(scale(start, mt * mt), scale(control, 2 * mt * t)), scale(end, t * t))
    );
  }
  return points;
}

export function polylineLength(points: Vector3[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) total += calculateDistance(points[i - 1], points[i]);
  return total;
}

/**
 * Moves one joint and reconciles its directly-connected straight segments:
 * a locked segment keeps its far joint exactly `length` away by rotating it
 * around the moved joint's new position (the pole-calculation rule,
 * generalized from a single ground/tip pair to an arbitrary joint graph);
 * an unlocked segment just recalculates its length from the new positions.
 * This intentionally does not cascade past one hop — e.g. moving a hub
 * doesn't chase every leg's far ground point around — so a hub with two
 * locked legs can end up with a real length mismatch on the leg you didn't
 * drag. That's surfaced by validateTentDesign rather than silently solved,
 * the same way a single locked pole already reports a mismatch if its data
 * is ever inconsistent.
 *
 * Arc segments are not reconciled for length (see PoleSegment.lockedLength);
 * their `length` is simply kept up to date as an approximation of the
 * current curve whenever either endpoint or the through-joint moves.
 */
export function reconcileJointMove(
  joints: PoleJoint[],
  segments: PoleSegment[],
  movedJointId: string,
  newPosition: Vector3
): { joints: PoleJoint[]; segments: PoleSegment[] } {
  const jointMap = new Map(joints.map((j) => [j.id, { ...j }]));
  const moved = jointMap.get(movedJointId);
  if (!moved) return { joints, segments };
  moved.position = newPosition;

  const nextSegments = segments.map((seg) => ({ ...seg }));

  for (const seg of nextSegments) {
    if (seg.shape !== "straight") continue;
    const touchesMoved = seg.startJointId === movedJointId || seg.endJointId === movedJointId;
    if (!touchesMoved) continue;

    const otherId = seg.startJointId === movedJointId ? seg.endJointId : seg.startJointId;
    const other = jointMap.get(otherId);
    if (!other) continue;

    if (seg.lockedLength) {
      const distance = calculateDistance(newPosition, other.position);
      if (distance > 1e-9) {
        const direction = subtract(other.position, newPosition);
        jointMap.set(otherId, { ...other, position: add(newPosition, scale(direction, seg.length / distance)) });
      }
    } else {
      seg.length = calculateDistance(newPosition, other.position);
    }
  }

  for (const seg of nextSegments) {
    if (seg.shape !== "arc" || !seg.archJointId) continue;
    const start = jointMap.get(seg.startJointId);
    const end = jointMap.get(seg.endJointId);
    const apex = jointMap.get(seg.archJointId);
    if (start && end && apex) {
      seg.length = polylineLength(sampleArc(start.position, apex.position, end.position));
    }
  }

  return { joints: Array.from(jointMap.values()), segments: nextSegments };
}

/** The actual current length of a segment given its joints' live positions. */
export function currentSegmentLength(
  segment: PoleSegment,
  jointLookup: Map<string, Vector3>
): number | undefined {
  const start = jointLookup.get(segment.startJointId);
  const end = jointLookup.get(segment.endJointId);
  if (!start || !end) return undefined;

  if (segment.shape === "straight") {
    return calculateDistance(start, end);
  }

  const apex = segment.archJointId ? jointLookup.get(segment.archJointId) : undefined;
  if (!apex) return undefined;
  return polylineLength(sampleArc(start, apex, end));
}
