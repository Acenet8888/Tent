import { useTentStore } from "../../state/tentStore";
import { useSelectionStore, type SelectionKind } from "../../state/selectionStore";
import type { AnchorPoint, AnchorType, PoleJoint, PoleJointType, PoleSegment } from "../../types/tent";

const ANCHOR_COLORS: Record<AnchorType, string> = {
  corner: "#3b6ef0",
  stake: "#2e9e5b",
  "tie-out": "#c77b17",
  eave: "#7a4fd6",
};

const JOINT_COLORS: Record<PoleJointType, string> = {
  ground: "#3b6ef0",
  hub: "#8a3fd6",
  apex: "#e0455b",
};

const SEGMENT_COLOR = "#5b636e";

const ANCHOR_GROUP_LABELS: Record<AnchorType, string> = {
  corner: "Corners",
  stake: "Stakes",
  "tie-out": "Tie-outs",
  eave: "Eaves",
};

const JOINT_GROUP_LABELS: Record<PoleJointType, string> = {
  ground: "Ground points",
  hub: "Hubs",
  apex: "Apex points",
};

function Dot({ color }: { color: string }) {
  return (
    <span
      style={{
        display: "inline-block",
        width: 8,
        height: 8,
        borderRadius: "50%",
        background: color,
        flexShrink: 0,
      }}
    />
  );
}

function Row({
  label,
  detail,
  color,
  kind,
  id,
}: {
  label: string;
  detail?: string;
  color: string;
  kind: SelectionKind;
  id: string;
}) {
  const selection = useSelectionStore((s) => s.selection);
  const select = useSelectionStore((s) => s.select);
  const isSelected = selection?.kind === kind && selection.id === id;

  return (
    <button
      className={`component-row${isSelected ? " selected" : ""}`}
      onClick={() => select(kind, id)}
    >
      <Dot color={color} />
      <span className="component-row-label">{label}</span>
      {detail && <span className="component-row-detail">{detail}</span>}
    </button>
  );
}

function AnchorGroup({ type, anchors }: { type: AnchorType; anchors: AnchorPoint[] }) {
  if (anchors.length === 0) return null;
  return (
    <div className="component-group">
      <h4>
        {ANCHOR_GROUP_LABELS[type]} <span className="component-count">{anchors.length}</span>
      </h4>
      {anchors.map((a) => (
        <Row key={a.id} label={a.name} color={ANCHOR_COLORS[type]} kind="anchor" id={a.id} />
      ))}
    </div>
  );
}

function JointGroup({ type, joints }: { type: PoleJointType; joints: PoleJoint[] }) {
  if (joints.length === 0) return null;
  return (
    <div className="component-group">
      <h4>
        {JOINT_GROUP_LABELS[type]} <span className="component-count">{joints.length}</span>
      </h4>
      {joints.map((j) => (
        <Row key={j.id} label={j.name} color={JOINT_COLORS[type]} kind="joint" id={j.id} />
      ))}
    </div>
  );
}

function SegmentGroup({ segments }: { segments: PoleSegment[] }) {
  if (segments.length === 0) return null;
  return (
    <div className="component-group">
      <h4>
        Poles <span className="component-count">{segments.length}</span>
      </h4>
      {segments.map((s) => (
        <Row key={s.id} label={s.name} detail={s.shape} color={SEGMENT_COLOR} kind="segment" id={s.id} />
      ))}
    </div>
  );
}

const ANCHOR_TYPES: AnchorType[] = ["corner", "eave", "stake", "tie-out"];
const JOINT_TYPES: PoleJointType[] = ["ground", "hub", "apex"];

export function ComponentList() {
  const design = useTentStore((s) => s.design);

  return (
    <div className="component-list">
      <h3>Components</h3>
      {ANCHOR_TYPES.map((type) => (
        <AnchorGroup key={type} type={type} anchors={design.anchors.filter((a) => a.type === type)} />
      ))}
      {JOINT_TYPES.map((type) => (
        <JointGroup key={type} type={type} joints={design.poleJoints.filter((j) => j.type === type)} />
      ))}
      <SegmentGroup segments={design.poleSegments} />
    </div>
  );
}
