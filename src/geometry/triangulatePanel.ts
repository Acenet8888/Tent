import type { Vector3 } from "../types/tent";

export type Triangle = [number, number, number];

export type TriangulatedPanel = {
  vertices: Vector3[];
  triangles: Triangle[];
};

type Point2D = { x: number; y: number };

function signedArea2D(points: Point2D[]): number {
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    area += a.x * b.y - b.x * a.y;
  }
  return area / 2;
}

function isPointInTriangle(p: Point2D, a: Point2D, b: Point2D, c: Point2D): boolean {
  const sign = (p1: Point2D, p2: Point2D, p3: Point2D) =>
    (p1.x - p3.x) * (p2.y - p3.y) - (p2.x - p3.x) * (p1.y - p3.y);
  const d1 = sign(p, a, b);
  const d2 = sign(p, b, c);
  const d3 = sign(p, c, a);
  const hasNeg = d1 < 0 || d2 < 0 || d3 < 0;
  const hasPos = d1 > 0 || d2 > 0 || d3 > 0;
  return !(hasNeg && hasPos);
}

/**
 * Standard ear-clipping triangulation of a simple polygon (works for
 * concave shapes, unlike a fan from a single vertex — a fan is only valid
 * when every vertex is visible from vertex 0, which a boundary that dips
 * inward, like a hoop pole's arc bowing down through a roof slope, breaks).
 * Runs on the polygon's (x,y) projection to decide which vertex triples are
 * valid "ears"; the caller maps the resulting index triples back onto the
 * original (possibly non-planar) 3D points.
 */
function earClipIndices(points2D: Point2D[]): Triangle[] {
  const n = points2D.length;
  if (n < 3) return [];
  if (n === 3) return [[0, 1, 2]];

  let indices = Array.from({ length: n }, (_, i) => i);
  if (signedArea2D(points2D) < 0) indices = indices.reverse();

  const triangles: Triangle[] = [];
  let guard = 0;
  while (indices.length > 3 && guard < n * n) {
    guard++;
    let clipped = false;

    for (let i = 0; i < indices.length; i++) {
      const iPrev = indices[(i - 1 + indices.length) % indices.length];
      const iCurr = indices[i];
      const iNext = indices[(i + 1) % indices.length];
      const a = points2D[iPrev];
      const b = points2D[iCurr];
      const c = points2D[iNext];

      const cross = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
      if (cross <= 1e-9) continue; // reflex or degenerate: not an ear candidate

      let containsOther = false;
      for (const j of indices) {
        if (j === iPrev || j === iCurr || j === iNext) continue;
        if (isPointInTriangle(points2D[j], a, b, c)) {
          containsOther = true;
          break;
        }
      }
      if (containsOther) continue;

      triangles.push([iPrev, iCurr, iNext]);
      indices.splice(i, 1);
      clipped = true;
      break;
    }

    // Numerically degenerate polygon (near-collinear points, etc.): fall
    // back to fanning the remainder from the first vertex rather than
    // looping forever or dropping geometry.
    if (!clipped) break;
  }

  if (indices.length >= 3) {
    for (let i = 1; i < indices.length - 1; i++) {
      triangles.push([indices[0], indices[i], indices[i + 1]]);
    }
  }

  return triangles;
}

/**
 * Stage 1: deterministic panel geometry. Triangulates a panel boundary of
 * any size via ear-clipping (projected onto the x/z plane, since every
 * panel in this app is roof/wall/floor-like — it varies in height but
 * doesn't fold back over itself horizontally), so a boundary that dips
 * inward (a hoop's arc) still produces a valid, non-overlapping mesh
 * instead of the self-overlapping triangles a naive fan would create.
 */
export function triangulatePanel(boundary: Vector3[]): TriangulatedPanel {
  if (boundary.length < 3) {
    throw new Error("A fabric panel needs at least 3 boundary points");
  }

  const projected = boundary.map((p) => ({ x: p.x, y: p.z }));
  const triangles = earClipIndices(projected);

  return { vertices: boundary, triangles };
}
