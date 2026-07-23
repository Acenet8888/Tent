import { useTentStore } from "../../state/tentStore";
import { useSelectionStore } from "../../state/selectionStore";
import { usePoleBuilderStore } from "../../state/poleBuilderStore";
import { fromMillimeters, toMillimeters } from "../../units/conversions";
import type { PoleSegmentKind, Vector3 } from "../../types/tent";

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

const SEGMENT_KIND_LABELS: Record<PoleSegmentKind, string> = {
  "trekking-pole": "Trekking pole",
  "straight-pole": "Straight pole",
  "support-pole": "Support pole",
  "hoop-pole": "Hoop pole",
  "spreader-pole": "Spreader pole",
};

export function ObjectProperties() {
  const design = useTentStore((s) => s.design);
  const moveAnchor = useTentStore((s) => s.moveAnchor);
  const removeAnchor = useTentStore((s) => s.removeAnchor);
  const addAnchor = useTentStore((s) => s.addAnchor);
  const moveJoint = useTentStore((s) => s.moveJoint);
  const removeJoint = useTentStore((s) => s.removeJoint);
  const addJoint = useTentStore((s) => s.addJoint);
  const addSegment = useTentStore((s) => s.addSegment);
  const removeSegment = useTentStore((s) => s.removeSegment);
  const toggleSegmentLockedLength = useTentStore((s) => s.toggleSegmentLockedLength);
  const setSegmentLength = useTentStore((s) => s.setSegmentLength);
  const addStraightPoleTemplate = useTentStore((s) => s.addStraightPoleTemplate);
  const addHoopPoleTemplate = useTentStore((s) => s.addHoopPoleTemplate);
  const addHubPoleSetTemplate = useTentStore((s) => s.addHubPoleSetTemplate);

  const selection = useSelectionStore((s) => s.selection);
  const clearSelection = useSelectionStore((s) => s.clear);
  const pendingJointId = usePoleBuilderStore((s) => s.pendingJointId);
  const startConnection = usePoleBuilderStore((s) => s.startConnection);
  const cancelConnection = usePoleBuilderStore((s) => s.cancelConnection);

  const unit = design.dimensions.unit;
  const halfLength = design.dimensions.length / 2;
  const halfWidth = design.dimensions.width / 2;
  const peakHeight = design.dimensions.peakHeight;

  const addStake = () => {
    addAnchor("stake", { x: halfLength + toMillimeters(300, unit), y: 0, z: 0 }, "Stake");
  };
  const addTieOut = () => {
    addAnchor("tie-out", { x: 0, y: peakHeight / 2, z: halfWidth }, "Tie-out");
  };

  const addStraightPole = () => {
    addStraightPoleTemplate({ x: 0, y: 0, z: halfWidth }, { x: 0, y: peakHeight * 0.6, z: 0 });
  };
  const addHoopPole = () => {
    addHoopPoleTemplate({ x: 0, y: 0, z: -halfWidth }, { x: 0, y: peakHeight, z: 0 }, { x: 0, y: 0, z: halfWidth });
  };
  const addHubPoleSet = () => {
    const hubHeight = peakHeight * 0.7;
    addHubPoleSetTemplate({ x: -halfLength / 2, y: hubHeight, z: 0 }, { x: halfLength / 2, y: hubHeight, z: 0 }, [
      { x: -halfLength / 2, y: 0, z: -halfWidth / 2 },
      { x: -halfLength / 2, y: 0, z: halfWidth / 2 },
      { x: halfLength / 2, y: 0, z: -halfWidth / 2 },
      { x: halfLength / 2, y: 0, z: halfWidth / 2 },
    ]);
  };
  const addLoneHub = () => {
    addJoint("hub", { x: 0, y: peakHeight * 0.5, z: 0 });
  };

  return (
    <div className="object-properties">
      <h3>Anchors</h3>
      <div className="add-buttons">
        <button onClick={addStake}>+ Stake</button>
        <button onClick={addTieOut}>+ Tie-out</button>
      </div>

      <h3>Pole system</h3>
      <div className="add-buttons">
        <button onClick={addStraightPole}>+ Straight pole</button>
        <button onClick={addHoopPole}>+ Hoop pole</button>
        <button onClick={addHubPoleSet}>+ Hub pole set</button>
        <button onClick={addLoneHub}>+ Hub</button>
      </div>
      <p className="hint">
        Templates drop in ready-made pieces you can drag into place. To join two existing
        joints yourself (e.g. attach a spreader to a hub), select one, click "Start connection
        here" below, then select the other.
      </p>

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

      {selection?.kind === "joint" &&
        (() => {
          const joint = design.poleJoints.find((j) => j.id === selection.id);
          if (!joint) return null;
          const commit = (partial: Partial<Vector3>) => moveJoint(joint.id, { ...joint.position, ...partial });
          const pendingJoint = pendingJointId ? design.poleJoints.find((j) => j.id === pendingJointId) : undefined;

          return (
            <div className="selected-point">
              <h4>{joint.name}</h4>
              <p className="type-label">{joint.type}</p>
              <Coord label="X" valueMm={joint.position.x} unit={unit} onCommit={(v) => commit({ x: v })} />
              <Coord label="Y" valueMm={joint.position.y} unit={unit} onCommit={(v) => commit({ y: v })} />
              <Coord label="Z" valueMm={joint.position.z} unit={unit} onCommit={(v) => commit({ z: v })} />

              <div className="connect-controls">
                {!pendingJointId && (
                  <button onClick={() => startConnection(joint.id)}>Start connection here</button>
                )}
                {pendingJointId === joint.id && (
                  <button onClick={cancelConnection}>Cancel connection start</button>
                )}
                {pendingJointId && pendingJointId !== joint.id && pendingJoint && (
                  <ConnectJointForm
                    fromName={pendingJoint.name}
                    toName={joint.name}
                    onConnect={(kind) => {
                      addSegment(pendingJointId, joint.id, kind);
                      cancelConnection();
                    }}
                    onCancel={cancelConnection}
                  />
                )}
              </div>

              <button
                className="danger"
                onClick={() => {
                  removeJoint(joint.id);
                  clearSelection();
                }}
              >
                Delete joint
              </button>
            </div>
          );
        })()}

      {selection?.kind === "segment" &&
        (() => {
          const segment = design.poleSegments.find((s) => s.id === selection.id);
          if (!segment) return null;
          return (
            <div className="selected-point">
              <h4>{segment.name}</h4>
              <p className="type-label">
                {SEGMENT_KIND_LABELS[segment.kind]} · {segment.shape}
              </p>
              {segment.shape === "straight" ? (
                <div className="pole-length">
                  <Coord
                    label="Length"
                    valueMm={segment.length}
                    unit={unit}
                    onCommit={(mm) => setSegmentLength(segment.id, mm)}
                  />
                  <label>
                    <input
                      type="checkbox"
                      checked={segment.lockedLength}
                      onChange={() => toggleSegmentLockedLength(segment.id)}
                    />
                    Lock length
                  </label>
                </div>
              ) : (
                <p className="hint">
                  Arc length ({fromMillimeters(segment.length, unit as never).toFixed(2)} {unit}) is
                  computed live from its ground and peak points; hoop poles don't lock a length.
                </p>
              )}
              <button
                className="danger"
                onClick={() => {
                  removeSegment(segment.id);
                  clearSelection();
                }}
              >
                Delete segment
              </button>
            </div>
          );
        })()}
    </div>
  );
}

function ConnectJointForm({
  fromName,
  toName,
  onConnect,
  onCancel,
}: {
  fromName: string;
  toName: string;
  onConnect: (kind: PoleSegmentKind) => void;
  onCancel: () => void;
}) {
  const kinds: PoleSegmentKind[] = ["spreader-pole", "support-pole", "straight-pole", "trekking-pole"];
  return (
    <div className="connect-form">
      <p className="hint">
        Connect "{fromName}" → "{toName}" as:
      </p>
      <div className="add-buttons">
        {kinds.map((kind) => (
          <button key={kind} onClick={() => onConnect(kind)}>
            {SEGMENT_KIND_LABELS[kind]}
          </button>
        ))}
      </div>
      <button onClick={onCancel}>Cancel</button>
    </div>
  );
}
