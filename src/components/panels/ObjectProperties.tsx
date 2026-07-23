import { useTentStore } from "../../state/tentStore";
import { useSelectionStore } from "../../state/selectionStore";
import { fromMillimeters, toMillimeters } from "../../units/conversions";
import type { Vector3 } from "../../types/tent";

function Coord({
  label,
  valueMm,
  unit,
  onCommit,
}: {
  label: string;
  valueMm: number;
  unit: string;
  onCommit: (mm: number) => void;
}) {
  const displayed = fromMillimeters(valueMm, unit as never);
  return (
    <label className="coord-field">
      <span>{label}</span>
      <input
        type="number"
        step="any"
        value={Number(displayed.toFixed(4))}
        onChange={(e) => {
          const next = Number(e.target.value);
          if (Number.isFinite(next)) onCommit(toMillimeters(next, unit as never));
        }}
      />
    </label>
  );
}

export function ObjectProperties() {
  const design = useTentStore((s) => s.design);
  const moveAnchor = useTentStore((s) => s.moveAnchor);
  const removeAnchor = useTentStore((s) => s.removeAnchor);
  const updatePoleGroundPosition = useTentStore((s) => s.updatePoleGroundPosition);
  const updatePoleTipPosition = useTentStore((s) => s.updatePoleTipPosition);
  const toggleLockedLength = useTentStore((s) => s.toggleLockedLength);
  const setPoleLength = useTentStore((s) => s.setPoleLength);
  const removePole = useTentStore((s) => s.removePole);
  const addAnchor = useTentStore((s) => s.addAnchor);
  const addPole = useTentStore((s) => s.addPole);
  const selection = useSelectionStore((s) => s.selection);
  const clearSelection = useSelectionStore((s) => s.clear);

  const unit = design.dimensions.unit;

  const addStake = () => {
    const halfLength = design.dimensions.length / 2 + toMillimeters(300, unit);
    addAnchor("stake", { x: halfLength, y: 0, z: 0 }, "Stake");
  };
  const addTieOut = () => {
    addAnchor("tie-out", { x: 0, y: design.dimensions.peakHeight / 2, z: design.dimensions.width / 2 }, "Tie-out");
  };
  const addSupportPole = () => {
    addPole({ x: 0, y: 0, z: design.dimensions.width / 2 }, { x: 0, y: design.dimensions.peakHeight * 0.6, z: 0 });
  };

  return (
    <div className="object-properties">
      <h3>Points</h3>
      <div className="add-buttons">
        <button onClick={addStake}>+ Stake</button>
        <button onClick={addTieOut}>+ Tie-out</button>
        <button onClick={addSupportPole}>+ Support Pole</button>
      </div>

      {!selection && <p className="hint">Select a point in either view to edit it here.</p>}

      {selection?.kind === "anchor" &&
        (() => {
          const anchor = design.anchors.find((a) => a.id === selection.id);
          if (!anchor) return null;
          const commit = (partial: Partial<Vector3>) =>
            moveAnchor(anchor.id, { ...anchor.position, ...partial });
          return (
            <div className="selected-point">
              <h4>{anchor.name}</h4>
              <p className="type-label">{anchor.type}</p>
              <Coord label="X" valueMm={anchor.position.x} unit={unit} onCommit={(v) => commit({ x: v })} />
              <Coord label="Y" valueMm={anchor.position.y} unit={unit} onCommit={(v) => commit({ y: v })} />
              <Coord label="Z" valueMm={anchor.position.z} unit={unit} onCommit={(v) => commit({ z: v })} />
              {(anchor.type === "stake" || anchor.type === "tie-out") && (
                <button
                  className="danger"
                  onClick={() => {
                    removeAnchor(anchor.id);
                    clearSelection();
                  }}
                >
                  Delete point
                </button>
              )}
            </div>
          );
        })()}

      {selection?.kind === "pole-ground" &&
        (() => {
          const pole = design.poles.find((p) => p.id === selection.id);
          if (!pole) return null;
          const commit = (partial: Partial<Vector3>) =>
            updatePoleGroundPosition(pole.id, { ...pole.groundPosition, ...partial });
          return (
            <div className="selected-point">
              <h4>{pole.name} (base)</h4>
              <Coord label="X" valueMm={pole.groundPosition.x} unit={unit} onCommit={(v) => commit({ x: v })} />
              <Coord label="Y" valueMm={pole.groundPosition.y} unit={unit} onCommit={(v) => commit({ y: v })} />
              <Coord label="Z" valueMm={pole.groundPosition.z} unit={unit} onCommit={(v) => commit({ z: v })} />
              <PoleLengthControls pole={pole} unit={unit} onToggleLock={() => toggleLockedLength(pole.id)} onSetLength={(mm) => setPoleLength(pole.id, mm)} />
              {design.poles.length > 2 && (
                <button className="danger" onClick={() => { removePole(pole.id); clearSelection(); }}>
                  Delete pole
                </button>
              )}
            </div>
          );
        })()}

      {selection?.kind === "pole-tip" &&
        (() => {
          const pole = design.poles.find((p) => p.id === selection.id);
          if (!pole) return null;
          const commit = (partial: Partial<Vector3>) =>
            updatePoleTipPosition(pole.id, { ...pole.topPosition, ...partial });
          return (
            <div className="selected-point">
              <h4>{pole.name} (tip)</h4>
              <Coord label="X" valueMm={pole.topPosition.x} unit={unit} onCommit={(v) => commit({ x: v })} />
              <Coord label="Y" valueMm={pole.topPosition.y} unit={unit} onCommit={(v) => commit({ y: v })} />
              <Coord label="Z" valueMm={pole.topPosition.z} unit={unit} onCommit={(v) => commit({ z: v })} />
              <PoleLengthControls pole={pole} unit={unit} onToggleLock={() => toggleLockedLength(pole.id)} onSetLength={(mm) => setPoleLength(pole.id, mm)} />
            </div>
          );
        })()}
    </div>
  );
}

function PoleLengthControls({
  pole,
  unit,
  onToggleLock,
  onSetLength,
}: {
  pole: { length: number; lockedLength: boolean };
  unit: string;
  onToggleLock: () => void;
  onSetLength: (mm: number) => void;
}) {
  return (
    <div className="pole-length">
      <Coord label="Length" valueMm={pole.length} unit={unit} onCommit={onSetLength} />
      <label>
        <input type="checkbox" checked={pole.lockedLength} onChange={onToggleLock} />
        Lock length
      </label>
    </div>
  );
}
