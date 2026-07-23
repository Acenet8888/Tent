# Tent Designer

A parametric tent design tool: a linked 2D floor-plan editor and 3D viewport
for building a rectangular A-frame/ridge tent, per the MVP boundary described
in the project brief.

## Stack

React + TypeScript + Vite, Three.js via `@react-three/fiber`/`@react-three/drei`
for the 3D view, and Zustand for state.

## Getting started

```bash
npm install
npm run dev      # start the dev server
npm run build    # type-check and produce a production build
```

## Architecture

- `src/types/tent.ts` — the core `TentDesign` data model.
- `src/units/conversions.ts` — all measurements are stored internally in
  millimetres; this module converts to/from the user's display unit
  (mm/cm/m/in/ft).
- `src/geometry/` — pure functions that turn dimensions into a default tent
  (`generateTentGeometry.ts`), resolve fabric panel boundaries
  (`generateFabricPanels.ts`), triangulate them for rendering
  (`triangulatePanel.ts`), and (for future Milestone 5 work) subdivide and
  relax a panel into a tensioned-fabric look (`relaxFabricMesh.ts`).
- `src/state/` — Zustand stores: `tentStore` (the design + edit actions),
  `historyStore` (undo/redo), `selectionStore` (the currently selected point),
  `cameraStore` (3D camera presets).
- `src/validation/validateTentDesign.ts` — pole-length consistency,
  duplicate-point, self-intersecting-panel, and dimension-limit checks.
- `src/components/editor2d/` — the SVG floor-plan editor (the primary,
  precise editing surface: drag, snap-to-grid, dimension lines).
- `src/components/editor3d/` — the linked Three.js viewport (poles,
  ridgelines, fabric, camera presets, wireframe/transparency toggles).
- `src/components/panels/` and `src/components/layout/` — the surrounding
  UI: dimension inputs, per-point properties, view toggles, undo/redo.

## Coordinate system

`x` = tent length, `y` = height, `z` = tent width. Floor is `y = 0`, tent
centre is `(0, 0, 0)`. All values are stored in millimetres regardless of
the unit shown in the UI.

## Pole calculation rule

A pole's length is `calculateDistance(groundPosition, topPosition)`. When
`lockedLength` is on, dragging the tip keeps it exactly `length` away from
the ground position (see `geometry/measurements.ts:reconcilePole`); when
it's off, dragging the tip recalculates `length` instead.

## Current scope

Milestones 1–4 (parametric base tent, interactive 2D editor, linked 3D view,
custom poles/anchors) plus Stage-1 deterministic fabric panels, undo/redo,
and the validation checks listed above. Fabric relaxation (Milestone 5's
tensioned-fabric look) has its geometry module in place but isn't wired into
the renderer yet, so the 3D view always shows the exact deterministic panel
shape.
