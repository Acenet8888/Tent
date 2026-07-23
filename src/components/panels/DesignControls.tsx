import { useTentStore } from "../../state/tentStore";
import { useHistoryStore } from "../../state/historyStore";
import { ALL_UNITS, UNIT_LABELS, fromMillimeters } from "../../units/conversions";
import type { LengthUnit } from "../../types/tent";

function DimensionField({
  label,
  valueMm,
  unit,
  onCommit,
}: {
  label: string;
  valueMm: number;
  unit: LengthUnit;
  onCommit: (valueInUnit: number) => void;
}) {
  const displayValue = fromMillimeters(valueMm, unit);
  return (
    <label className="dimension-field">
      <span>{label}</span>
      <input
        type="number"
        step="any"
        value={Number.isFinite(displayValue) ? Number(displayValue.toFixed(4)) : 0}
        onChange={(e) => {
          const next = Number(e.target.value);
          if (Number.isFinite(next)) onCommit(next);
        }}
      />
      <span className="unit-suffix">{unit}</span>
    </label>
  );
}

export function DesignControls() {
  const dimensions = useTentStore((s) => s.design.dimensions);
  const setDimensions = useTentStore((s) => s.setDimensions);
  const setDisplayUnit = useTentStore((s) => s.setDisplayUnit);
  const resetToDefault = useTentStore((s) => s.resetToDefault);
  const undo = useTentStore((s) => s.undo);
  const redo = useTentStore((s) => s.redo);
  const canUndo = useHistoryStore((s) => s.past.length > 0);
  const canRedo = useHistoryStore((s) => s.future.length > 0);

  const unit = dimensions.unit;
  const hasWalls = dimensions.wallHeight !== undefined && dimensions.wallHeight > 0;

  return (
    <div className="design-controls">
      <h3>Dimensions</h3>

      <DimensionField
        label="Length (x)"
        valueMm={dimensions.length}
        unit={unit}
        onCommit={(v) => setDimensions({ length: v }, unit)}
      />
      <DimensionField
        label="Width (z)"
        valueMm={dimensions.width}
        unit={unit}
        onCommit={(v) => setDimensions({ width: v }, unit)}
      />
      <DimensionField
        label="Peak height (y)"
        valueMm={dimensions.peakHeight}
        unit={unit}
        onCommit={(v) => setDimensions({ peakHeight: v }, unit)}
      />
      <DimensionField
        label="Ground clearance"
        valueMm={dimensions.groundClearance}
        unit={unit}
        onCommit={(v) => setDimensions({ groundClearance: v }, unit)}
      />

      <label className="wall-toggle">
        <input
          type="checkbox"
          checked={hasWalls}
          onChange={(e) => {
            const enable = e.target.checked;
            resetToDefault({
              length: fromMillimeters(dimensions.length, unit),
              width: fromMillimeters(dimensions.width, unit),
              peakHeight: fromMillimeters(dimensions.peakHeight, unit),
              groundClearance: fromMillimeters(dimensions.groundClearance, unit),
              wallHeight: enable ? fromMillimeters(dimensions.peakHeight, unit) * 0.4 : undefined,
              unit,
            });
          }}
        />
        Vertical side walls (regenerates tent)
      </label>

      {hasWalls && (
        <DimensionField
          label="Wall height"
          valueMm={dimensions.wallHeight ?? 0}
          unit={unit}
          onCommit={(v) => setDimensions({ wallHeight: v }, unit)}
        />
      )}

      <label className="unit-select">
        <span>Display unit</span>
        <select value={unit} onChange={(e) => setDisplayUnit(e.target.value as LengthUnit)}>
          {ALL_UNITS.map((u) => (
            <option key={u} value={u}>
              {UNIT_LABELS[u]}
            </option>
          ))}
        </select>
      </label>

      <div className="history-controls">
        <button onClick={undo} disabled={!canUndo}>
          Undo
        </button>
        <button onClick={redo} disabled={!canRedo}>
          Redo
        </button>
      </div>
    </div>
  );
}
