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
  `historyStore` (undo/redo), `selectionStore` (the currently selected
  anchor/joint/segment), `cameraStore` (3D camera presets), `poleBuilderStore`
  (the pending-joint state for connecting two existing joints with a new
  segment).
- `src/validation/validateTentDesign.ts` — segment-length consistency,
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

## Pole system

A pole "system" is a graph rather than a fixed ground/tip pair, so it can
represent a plain straight pole, a transverse spreader, a hoop that bows
through a peak, or a hub that splits into several legs — all with the same
two primitives (`types/tent.ts`):

- **PoleJoint** — a connection point: `ground` (touches the floor), `hub`
  (a junction where segments meet, floating above the ground), or `apex` (a
  high point — a ridge/tip end, or the peak a hoop's arc bows through).
- **PoleSegment** — the physical pole material joining two joints, either
  `straight` or `arc` (a hoop's ground → peak → ground curve, via a
  quadratic Bezier solved to pass exactly through the peak at its midpoint —
  see `sampleArc` in `geometry/measurements.ts`).

Dragging a joint reconciles its directly-connected straight segments
(`reconcileJointMove`): a locked segment keeps its far joint exactly
`length` away by rotating around the joint you're dragging; an unlocked one
just recalculates its length. This intentionally doesn't cascade past one
hop, so a hub with two locked legs can end up with a real length mismatch on
the leg you didn't drag — `validateTentDesign` surfaces that rather than
silently solving it. Arc segments never enforce a locked length (preserving
arc length while repositioning a point is an inverse elastica problem this
MVP doesn't attempt); their length is just kept up to date live.

`panels/ObjectProperties.tsx` offers one-click templates (straight pole,
spreader pole, hoop pole, a "hub pole set" — two hubs joined by a spreader,
each splitting into two legs) plus two ways to join joints by hand:
"connect" adds a new strut between them, while "attach directly" (merge)
welds them into a single point — how you'd weld a spreader's end onto an
existing hub, since a spreader's own ends are hubs (`tentStore.mergeJoints`).

## Fly fabric follows the poles — explicitly, not automatically

The roof (fly) panels aren't fixed to the two original ridge ends — they're
recomputed after every edit (`geometry/regenerateFlyFabric.ts`, run from
`tentStore`'s shared `withHistory` wrapper) from whichever points are
currently flagged as fly attachments, sorted by x. The front/back slopes
become a fan from the front/back base line (the eave line if the tent has
walls, otherwise the floor corners, plus any stake/tie-out explicitly opted
in) across every attached joint, so adding a straight pole or a hoop
mid-tent bends the roofline through its peak instead of leaving it floating
under a flat, unchanged fly.

Which points count is an explicit flag (`PoleJoint.flyAttachment` /
`AnchorPoint.flyAttachment`, surfaced as a checkbox on the selected
joint/stake in ObjectProperties), not an automatic "wrap whatever sticks
out" solver — working out which points are on the outside for an arbitrary
3D pole arrangement is a hard problem in general, so instead: apex joints
default to attached and hub/ground joints default to not, but either can be
overridden per-joint (e.g. opt a hub into the roofline so the fly rests on
top of it), and a stake/tie-out can opt in to pull the fly's edge out to an
extra peg point. Floor and wall panels stay fixed to the corner/eave
anchors regardless, since they don't depend on how many poles exist.

One topology detail worth knowing if you touch this code: both slopes trace
their own base line ascending by x and the ridge *descending* by x — tracing
the ridge in the same direction as the base line produces a self-intersecting
bowtie quad instead of a simple trapezoid.

## Two-ended tie-outs

A tie-out anchor has two positions instead of one: `position` is where it
attaches to the tent fabric, and `groundPosition` is the separate point
where its guy-line stakes into the ground (`AnchorPoint.groundPosition`).
Both ends are independently draggable in the 2D plan (with a dashed leader
line between them) and rendered as a thin dashed guy-line in 3D
(`editor3d/TieOutMesh.tsx`).

## Dimension auto-sync

The Length/Width/Ground clearance/Peak height/Wall height fields in
`DesignControls` aren't independent inputs — they're kept in sync with the
actual geometry (corner anchors, apex joints, eave anchors) every time you
drag a corner, pole tip, or wall-top point, so the panel never goes stale
relative to what you dragged (see `syncDimensionsFromCorners` and friends in
`state/tentStore.ts`). Typing a new value still works the normal way: it
rescales the existing geometry proportionally rather than regenerating it,
so custom poles/anchors survive a resize.

## Current scope

Milestones 1–4 (parametric base tent, interactive 2D editor, linked 3D view,
custom poles/anchors — now generalized to hubs, spreaders, and hoops) plus
Stage-1 deterministic fabric panels, undo/redo, and the validation checks
listed above. Fabric relaxation (Milestone 5's tensioned-fabric look) has
its geometry module in place but isn't wired into the renderer yet, so the
3D view always shows the exact deterministic panel shape.
