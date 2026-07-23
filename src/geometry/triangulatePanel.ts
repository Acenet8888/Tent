import type { Vector3 } from "../types/tent";

export type Triangle = [number, number, number];

export type TriangulatedPanel = {
  vertices: Vector3[];
  triangles: Triangle[];
};

/**
 * Stage 1: deterministic panel geometry. A panel boundary is either a
 * triangle (3 points, already a single face) or a convex quad (4 points,
 * split into two triangles via a fan from vertex 0). This gives exact,
 * immediately-updating dimensions with no approximation.
 */
export function triangulatePanel(boundary: Vector3[]): TriangulatedPanel {
  if (boundary.length < 3) {
    throw new Error("A fabric panel needs at least 3 boundary points");
  }

  const triangles: Triangle[] = [];
  for (let i = 1; i < boundary.length - 1; i++) {
    triangles.push([0, i, i + 1]);
  }

  return { vertices: boundary, triangles };
}
