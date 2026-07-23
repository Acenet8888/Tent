import type { Pole, Vector3 } from "../types/tent";

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
 * Recomputes a pole's `topPosition` and `length` after its ground position
 * or tip has moved, honoring the pole-calculation rule: when the length is
 * locked, the tip is re-projected outward along its current direction so it
 * stays exactly `length` away from the ground position; when unlocked, the
 * length field is simply recalculated from the (possibly new) tip position.
 */
export function reconcilePole(pole: Pole, movedTip?: Vector3): Pole {
  const tip = movedTip ?? pole.topPosition;

  if (!pole.lockedLength) {
    return {
      ...pole,
      topPosition: tip,
      length: calculateDistance(pole.groundPosition, tip),
    };
  }

  const direction = subtract(tip, pole.groundPosition);
  const currentDistance = calculateDistance(pole.groundPosition, tip);

  if (currentDistance < 1e-9) {
    // Degenerate: tip coincides with the base. Keep the pole pointing
    // straight up rather than dividing by zero.
    return {
      ...pole,
      topPosition: add(pole.groundPosition, { x: 0, y: pole.length, z: 0 }),
    };
  }

  const normalized = scale(direction, pole.length / currentDistance);
  return {
    ...pole,
    topPosition: add(pole.groundPosition, normalized),
  };
}

/**
 * When the ground position moves (rather than the tip), the tip should
 * translate with it if the length is locked, or stay in place if it isn't
 * (which will change the calculated length).
 */
export function reconcilePoleForGroundMove(
  pole: Pole,
  newGroundPosition: Vector3
): Pole {
  if (pole.lockedLength) {
    const delta = subtract(newGroundPosition, pole.groundPosition);
    return {
      ...pole,
      groundPosition: newGroundPosition,
      topPosition: add(pole.topPosition, delta),
    };
  }

  return {
    ...pole,
    groundPosition: newGroundPosition,
    length: calculateDistance(newGroundPosition, pole.topPosition),
  };
}
