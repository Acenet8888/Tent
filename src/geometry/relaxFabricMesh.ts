import type { Vector3 } from "../types/tent";
import { add, scale } from "./measurements";

export type VertexConstraint = "fixed" | "semi-constrained" | "free";

export type SubdividedMesh = {
  vertices: Vector3[];
  constraints: VertexConstraint[];
  /** Adjacency list: neighbour vertex indices for each vertex. */
  neighbors: number[][];
};

/**
 * Stage 2: mesh subdivision. Builds a regular grid over a quad panel
 * (bilinear interpolation of the 4 boundary corners) or a triangular
 * fan-grid over a triangular panel, with enough internal vertices for the
 * relaxation pass to deform smoothly. Boundary vertices are marked
 * "semi-constrained" (they sit on a ridgeline/panel edge); everything
 * strictly inside the panel is "free".
 */
export function subdividePanel(boundary: Vector3[], resolution = 6): SubdividedMesh {
  if (boundary.length === 4) {
    return subdivideQuad(boundary, resolution);
  }
  if (boundary.length === 3) {
    return subdivideTriangle(boundary, resolution);
  }
  // Fan-shaped panels (5+ points) are left unsubdivided; Stage 1 geometry
  // is used as-is.
  return {
    vertices: boundary,
    constraints: boundary.map(() => "semi-constrained"),
    neighbors: boundary.map((_, i) => [
      (i + 1) % boundary.length,
      (i - 1 + boundary.length) % boundary.length,
    ]),
  };
}

function subdivideQuad(boundary: Vector3[], resolution: number): SubdividedMesh {
  const [p00, p10, p11, p01] = boundary;
  const n = Math.max(2, resolution);
  const vertices: Vector3[] = [];
  const constraints: VertexConstraint[] = [];
  const index = (u: number, v: number) => u * (n + 1) + v;

  for (let u = 0; u <= n; u++) {
    for (let v = 0; v <= n; v++) {
      const fu = u / n;
      const fv = v / n;
      const top = lerp(p00, p10, fu);
      const bottom = lerp(p01, p11, fu);
      vertices.push(lerp(top, bottom, fv));
      const onBoundary = u === 0 || u === n || v === 0 || v === n;
      constraints.push(onBoundary ? "semi-constrained" : "free");
    }
  }

  const neighbors: number[][] = vertices.map(() => []);
  for (let u = 0; u <= n; u++) {
    for (let v = 0; v <= n; v++) {
      const i = index(u, v);
      if (u > 0) neighbors[i].push(index(u - 1, v));
      if (u < n) neighbors[i].push(index(u + 1, v));
      if (v > 0) neighbors[i].push(index(u, v - 1));
      if (v < n) neighbors[i].push(index(u, v + 1));
    }
  }

  // Corners of the panel are structural attachment points, not just
  // boundary edge points, so pin them exactly.
  constraints[index(0, 0)] = "fixed";
  constraints[index(n, 0)] = "fixed";
  constraints[index(n, n)] = "fixed";
  constraints[index(0, n)] = "fixed";

  return { vertices, constraints, neighbors };
}

function subdivideTriangle(boundary: Vector3[], resolution: number): SubdividedMesh {
  const [p0, p1, p2] = boundary;
  const n = Math.max(2, resolution);
  const vertices: Vector3[] = [];
  const constraints: VertexConstraint[] = [];
  const rowStart: number[] = [];

  for (let i = 0; i <= n; i++) {
    rowStart.push(vertices.length);
    const a = i / n;
    const rowCount = n - i + 1;
    const edgeStart = lerp(p0, p2, a);
    const edgeEnd = lerp(p1, p2, a);
    for (let j = 0; j < rowCount; j++) {
      const b = rowCount === 1 ? 0 : j / (rowCount - 1);
      vertices.push(lerp(edgeStart, edgeEnd, b));
      const onBoundary = i === 0 || j === 0 || j === rowCount - 1;
      constraints.push(onBoundary ? "semi-constrained" : "free");
    }
  }

  const neighbors: number[][] = vertices.map(() => []);
  const link = (a: number, b: number) => {
    neighbors[a].push(b);
    neighbors[b].push(a);
  };

  for (let i = 0; i <= n; i++) {
    const rowCount = n - i + 1;
    for (let j = 0; j < rowCount; j++) {
      const cur = rowStart[i] + j;
      if (j < rowCount - 1) link(cur, rowStart[i] + j + 1);
      if (i < n) {
        const nextRowCount = n - (i + 1) + 1;
        if (j < nextRowCount) link(cur, rowStart[i + 1] + j);
        if (j > 0) link(cur, rowStart[i + 1] + j - 1);
      }
    }
  }

  constraints[0] = "fixed";
  constraints[rowStart[0] + n] = "fixed";
  constraints[rowStart[n]] = "fixed";

  return { vertices, constraints, neighbors };
}

function lerp(a: Vector3, b: Vector3, t: number): Vector3 {
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    z: a.z + (b.z - a.z) * t,
  };
}

export type RelaxOptions = {
  iterations?: number;
  gravity?: number;
  movementEpsilon?: number;
};

/**
 * Stage 3: simplified relaxation. Each iteration nudges free vertices
 * toward the average of their neighbours, adds a small downward gravity
 * term, then snaps fixed/semi-constrained vertices back to their exact
 * positions. This is deliberately not a full mass-spring solver — it's a
 * cheap approximation that gives fabric a tensioned, slightly-sagging look
 * without perturbing the exact Stage 1 panel dimensions (only the
 * displayed mesh moves; boundary points never do).
 */
export function relaxFabricMesh(mesh: SubdividedMesh, options: RelaxOptions = {}): Vector3[] {
  const iterations = options.iterations ?? 20;
  const gravity = options.gravity ?? 0;
  const movementEpsilon = options.movementEpsilon ?? 1e-4;

  const original = mesh.vertices.map((v) => ({ ...v }));
  let positions = mesh.vertices.map((v) => ({ ...v }));

  for (let iter = 0; iter < iterations; iter++) {
    let maxMovement = 0;
    const next = positions.map((p) => ({ ...p }));

    for (let i = 0; i < positions.length; i++) {
      if (mesh.constraints[i] !== "free") {
        next[i] = { ...original[i] };
        continue;
      }

      const neighborIds = mesh.neighbors[i];
      if (neighborIds.length === 0) continue;

      let sum: Vector3 = { x: 0, y: 0, z: 0 };
      for (const nId of neighborIds) {
        sum = add(sum, positions[nId]);
      }
      const average = scale(sum, 1 / neighborIds.length);
      const withGravity: Vector3 = { ...average, y: average.y - gravity };

      const movement = Math.hypot(
        withGravity.x - positions[i].x,
        withGravity.y - positions[i].y,
        withGravity.z - positions[i].z
      );
      maxMovement = Math.max(maxMovement, movement);
      next[i] = withGravity;
    }

    positions = next;
    if (maxMovement < movementEpsilon) break;
  }

  return positions;
}
