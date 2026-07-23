import { useRef } from "react";
import { useTentStore } from "../../state/tentStore";
import { useHistoryStore } from "../../state/historyStore";
import { ALL_UNITS, UNIT_LABELS, fromMillimeters } from "../../units/conversions";
import type { LengthUnit, TentDesign } from "../../types/tent";

/** Loose structural check — enough to catch "wrong file" without re-deriving a full schema validator. */
function looksLikeTentDesign(value: unknown): value is TentDesign {
  if (!value || typeof value !== "object") return false;
  const d = value as Record<string, unknown>;
  return (
    Array.isArray(d.anchors) &&
    Array.isArray(d.poleJoints) &&
    Array.isArray(d.poleSegments) &&
    Array.isArray(d.fabricPanels) &&
    typeof d.dimensions === "object" &&
    d.dimensions !== null
  );
}

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
  const design = useTentStore((s) => s.design);
  const dimensions = design.dimensions;
  const setDimensions = useTentStore((s) => s.setDimensions);
  const setDisplayUnit = useTentStore((s) => s.setDisplayUnit);
  const resetToDefault = useTentStore((s) => s.resetToDefault);
  const loadDesign = useTentStore((s) => s.loadDesign);
  const undo = useTentStore((s) => s.undo);
  const redo = useTentStore((s) => s.redo);
  const canUndo = useHistoryStore((s) => s.past.length > 0);
  const canRedo = useHistoryStore((s) => s.future.length > 0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const unit = dimensions.unit;
  const hasWalls = dimensions.wallHeight !== undefined && dimensions.wallHeight > 0;

  function handleSave() {
    const blob = new Blob([JSON.stringify(design, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "tent-design.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleLoadFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    file
      .text()
      .then((text) => {
        const parsed = JSON.parse(text);
        if (!looksLikeTentDesign(parsed)) {
          window.alert("That file doesn't look like a tent design (missing expected fields).");
          return;
        }
        useHistoryStore.getState().clear();
        loadDesign(parsed);
      })
      .catch(() => window.alert("Couldn't read that file as a tent design (invalid JSON)."));
  }

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

      <h3>Save / load</h3>
      <div className="add-buttons">
        <button onClick={handleSave}>Save design</button>
        <button onClick={() => fileInputRef.current?.click()}>Load design</button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,application/json"
          style={{ display: "none" }}
          onChange={handleLoadFile}
        />
      </div>
      <p className="hint">Save downloads the current design as a .json file; Load replaces the current design and clears undo history.</p>
    </div>
  );
}
