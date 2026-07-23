import type { Vector3 } from "../types/tent";
import { calculateDistance } from "./measurements";
import type { Triangle } from "./triangulatePanel";

export type FlatPoint = { x: number; y: number };

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Given two already-placed 2D points A and B and the true 3D distances
 * from A and B to a third point C, returns C's 2D position such that
 * triangle A-B-C winds counter-clockwise — the standard "unfold this
 * triangle flat" construction (law of cosines for the angle at A, then
 * rotate the A->B direction by that angle).
 */
function placeThirdVertex(a: FlatPoint, b: FlatPoint, distAC: number, distBC: number): FlatPoint {
  const dAB = Math.hypot(b.x - a.x, b.y - a.y) || 1e-9;
  const ux = (b.x - a.x) / dAB;
  const uy = (b.y - a.y) / dAB;

  const cosAngle = clamp((dAB * dAB + distAC * distAC - distBC * distBC) / (2 * dAB * distAC || 1e-9), -1, 1);
  const angle = Math.acos(cosAngle);
  const cosA = Math.cos(angle);
  const sinA = Math.sin(angle);

  return {
    x: a.x + distAC * (ux * cosA - uy * sinA),
    y: a.y + distAC * (ux * sinA + uy * cosA),
  };
}

/**
 * Flattens a triangulated 3D panel boundary into a 2D pattern piece,
 * preserving every triangle's true edge lengths exactly (via
 * placeThirdVertex, propagated triangle-by-triangle from a seed triangle
 * across shared edges). For a planar panel (a flat quad or triangle,
 * which is every panel except a hoop-affected roof slope) this reproduces
 * the exact flat shape with zero distortion — it's the same construction a
 * pattern-maker does by hand. For a genuinely curved panel (a hoop's
 * sampled arc bulging through a roof slope) flattening is inherently
 * approximate: a curved surface can't be unrolled flat without some
 * distortion or a dart, so this accepts small angular drift in exchange
 * for exact edge lengths, which is what actually matters for cutting
 * fabric to size.
 *
 * Returns one 2D point per input vertex, same indexing as `vertices`.
 */
export function flattenTriangulatedPolygon(vertices: Vector3[], triangles: Triangle[]): FlatPoint[] {
  const n = vertices.length;
  const placed: (FlatPoint | undefined)[] = new Array(n).fill(undefined);
  if (n === 0) return [];
  if (triangles.length === 0 || n < 3) {
    return vertices.map((_, i) => ({ x: i * 10, y: 0 }));
  }

  const dist3D = (i: number, j: number) => calculateDistance(vertices[i], vertices[j]);

  const [a0, b0, c0] = triangles[0];
  placed[a0] = { x: 0, y: 0 };
  placed[b0] = { x: dist3D(a0, b0), y: 0 };
  placed[c0] = placeThirdVertex(placed[a0], placed[b0], dist3D(a0, c0), dist3D(b0, c0));

  let progress = true;
  let guard = 0;
  while (progress && guard < triangles.length * 4 + 10) {
    guard++;
    progress = false;

    for (const triangle of triangles) {
      for (let k = 0; k < 3; k++) {
        const A = triangle[k];
        const B = triangle[(k + 1) % 3];
        const C = triangle[(k + 2) % 3];
        if (placed[A] !== undefined && placed[B] !== undefined && placed[C] === undefined) {
          placed[C] = placeThirdVertex(placed[A]!, placed[B]!, dist3D(A, C), dist3D(B, C));
          progress = true;
        }
      }
    }
  }

  // Any vertex an unconnected/degenerate triangulation never reached falls
  // back to a stub position rather than leaving it undefined.
  return placed.map((p, i) => p ?? { x: i * 10, y: -20 });
}

export function polygonPerimeter(points: FlatPoint[]): number {
  let total = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    total += Math.hypot(b.x - a.x, b.y - a.y);
  }
  return total;
}

/** Shoelace-formula area of a flattened polygon (unsigned). */
export function polygonArea(points: FlatPoint[]): number {
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    area += a.x * b.y - b.x * a.y;
  }
  return Math.abs(area) / 2;
}
