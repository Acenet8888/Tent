import { useTentStore } from "../../state/tentStore";
import { useCameraStore, type CameraPreset } from "../../state/cameraStore";

const PRESETS: { id: CameraPreset; label: string }[] = [
  { id: "iso", label: "Isometric" },
  { id: "front", label: "Front" },
  { id: "side", label: "Side" },
  { id: "top", label: "Top" },
];

export function ViewControls() {
  const display = useTentStore((s) => s.design.display);
  const setDisplayOption = useTentStore((s) => s.setDisplayOption);
  const requestPreset = useCameraStore((s) => s.requestPreset);

  return (
    <div className="view-controls">
      <h3>View</h3>

      <label>
        <input
          type="checkbox"
          checked={display.showDimensions}
          onChange={(e) => setDisplayOption({ showDimensions: e.target.checked })}
        />
        Show dimensions
      </label>
      <label>
        <input
          type="checkbox"
          checked={display.showGrid}
          onChange={(e) => setDisplayOption({ showGrid: e.target.checked })}
        />
        Show grid
      </label>
      <label>
        <input
          type="checkbox"
          checked={display.showPoles}
          onChange={(e) => setDisplayOption({ showPoles: e.target.checked })}
        />
        Show poles
      </label>
      <label>
        <input
          type="checkbox"
          checked={display.showWireframe}
          onChange={(e) => setDisplayOption({ showWireframe: e.target.checked })}
        />
        Wireframe fabric
      </label>
      <label>
        <input
          type="checkbox"
          checked={display.transparentFabric}
          onChange={(e) => setDisplayOption({ transparentFabric: e.target.checked })}
        />
        Transparent fabric
      </label>

      <h4>Camera</h4>
      <div className="camera-presets">
        {PRESETS.map((preset) => (
          <button key={preset.id} onClick={() => requestPreset(preset.id)}>
            {preset.label}
          </button>
        ))}
      </div>
    </div>
  );
}
