import type { AnchorPoint, FabricPanel, Pole, Ridgeline, Seam, Vector3 } from "../types/tent";

export type PointLookup = Map<string, Vector3>;

/**
 * Builds a lookup from every point id (anchors and pole tips/bases) to its
 * 3D position, so panel/seam generation can resolve boundary ids without
 * caring whether a point comes from an anchor or a pole.
 */
export function buildPointLookup(anchors: AnchorPoint[], poles: Pole[]): PointLookup {
  const lookup: PointLookup = new Map();
  for (const anchor of anchors) {
    lookup.set(anchor.id, anchor.position);
  }
  for (const pole of poles) {
    lookup.set(`${pole.id}:ground`, pole.groundPosition);
    lookup.set(`${pole.id}:tip`, pole.topPosition);
  }
  return lookup;
}

export function resolvePoint(lookup: PointLookup, pointId: string): Vector3 | undefined {
  return lookup.get(pointId);
}

/** Resolves a panel's boundary point ids into their current 3D positions. */
export function resolvePanelBoundary(lookup: PointLookup, panel: FabricPanel): Vector3[] {
  return panel.boundaryPointIds
    .map((id) => resolvePoint(lookup, id))
    .filter((p): p is Vector3 => p !== undefined);
}

/** Resolves a ridgeline's two endpoint ids into their current 3D positions. */
export function resolveRidgeline(
  lookup: PointLookup,
  ridgeline: Ridgeline
): [Vector3, Vector3] | undefined {
  const start = resolvePoint(lookup, ridgeline.startPointId);
  const end = resolvePoint(lookup, ridgeline.endPointId);
  if (!start || !end) return undefined;
  return [start, end];
}

export type PanelSpec = {
  name: string;
  boundaryPointIds: string[];
  materialId?: string;
};

/**
 * Stage 1 (deterministic panel geometry): wraps flat panel specs into
 * FabricPanel records. The actual 3D boundary is resolved later, at render
 * time, via buildPointLookup + resolvePoint so panels always reflect the
 * current pole/anchor positions instead of a stale snapshot.
 */
export function generateFabricPanels(specs: PanelSpec[]): FabricPanel[] {
  return specs.map((spec, index) => ({
    id: `panel-${index}-${spec.name.toLowerCase().replace(/\s+/g, "-")}`,
    name: spec.name,
    boundaryPointIds: spec.boundaryPointIds,
    materialId: spec.materialId,
  }));
}

/**
 * Derives fabric seams from the edges shared by two or more panels. Each
 * shared edge becomes a Seam so the sewing/assembly view can show seam
 * allowances without the panel generator having to hardcode which edges
 * are structural.
 */
export function deriveSeamsFromPanels(panels: FabricPanel[]): Seam[] {
  const edgeOwners = new Map<string, string[]>();

  for (const panel of panels) {
    const ids = panel.boundaryPointIds;
    for (let i = 0; i < ids.length; i++) {
      const a = ids[i];
      const b = ids[(i + 1) % ids.length];
      const key = [a, b].sort().join("::");
      const owners = edgeOwners.get(key) ?? [];
      owners.push(panel.id);
      edgeOwners.set(key, owners);
    }
  }

  const seams: Seam[] = [];
  for (const [key, owners] of edgeOwners.entries()) {
    if (owners.length < 2) continue;
    const [a, b] = key.split("::");
    seams.push({
      id: `seam-${a}-${b}`,
      pointIds: [a, b],
    });
  }
  return seams;
}
