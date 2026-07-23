import { useMemo, useState } from "react";
import { useTentStore } from "../../state/tentStore";
import { useSelectionStore, type SelectionKind } from "../../state/selectionStore";
import type { AnchorPoint, AnchorType, LengthUnit, PoleJoint, PoleJointType, PoleSegment, TentDesign } from "../../types/tent";
import { formatLength } from "../../units/conversions";
import {
  DEFAULT_POLE_DIAMETER_MM,
  DEFAULT_POLE_WALL_THICKNESS_MM,
  estimatePoleWeightGrams,
  formatWeight,
  type WeightUnit,
} from "../../geometry/poleWeight";
import {
  FABRIC_DENSITY_G_PER_M2,
  FABRIC_LABELS,
  computeFlyAreaMm2,
  estimateFlyWeightGrams,
  type FabricType,
} from "../../geometry/fabricWeight";

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
  meta,
  color,
  kind,
  id,
}: {
  label: string;
  detail?: string;
  meta?: string;
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
      <span className="component-row-text">
        <span className="component-row-label">{label}</span>
        {meta && <span className="component-row-meta">{meta}</span>}
      </span>
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

function SegmentGroup({
  segments,
  lengthUnit,
  weightUnit,
}: {
  segments: PoleSegment[];
  lengthUnit: LengthUnit;
  weightUnit: WeightUnit;
}) {
  if (segments.length === 0) return null;

  return (
    <div className="component-group">
      <h4>
        Poles <span className="component-count">{segments.length}</span>
      </h4>
      {segments.map((s) => (
        <Row
          key={s.id}
          label={s.name}
          meta={`${formatLength(s.length, lengthUnit)} · ${formatWeight(estimatePoleWeightGrams(s), weightUnit)}`}
          detail={s.shape}
          color={SEGMENT_COLOR}
          kind="segment"
          id={s.id}
        />
      ))}
    </div>
  );
}

const FABRIC_TYPES: FabricType[] = ["dcf", "silnylon-20d"];

function WeightsSection({ design }: { design: TentDesign }) {
  const [weightUnit, setWeightUnit] = useState<WeightUnit>("g");
  const [fabricType, setFabricType] = useState<FabricType>("dcf");

  const poleWeightGrams = design.poleSegments.reduce((sum, s) => sum + estimatePoleWeightGrams(s), 0);
  const flyAreaMm2 = useMemo(() => computeFlyAreaMm2(design), [design]);
  const flyAreaM2 = flyAreaMm2 / 1_000_000;
  const flyWeightGrams = estimateFlyWeightGrams(flyAreaMm2, fabricType);
  const totalWeightGrams = poleWeightGrams + flyWeightGrams;

  if (design.poleSegments.length === 0 && flyAreaMm2 === 0) return null;

  return (
    <div className="component-group">
      <h4>
        <span>Weights</span>
        <span className="weight-unit-toggle">
          {(["g", "oz"] as WeightUnit[]).map((u) => (
            <button key={u} className={weightUnit === u ? "unit-active" : ""} onClick={() => setWeightUnit(u)}>
              {u}
            </button>
          ))}
        </span>
      </h4>

      <SegmentGroup segments={design.poleSegments} lengthUnit={design.dimensions.unit} weightUnit={weightUnit} />

      <div className="component-group">
        <h4>
          <span>Fly fabric</span>
          <span className="weight-unit-toggle">
            {FABRIC_TYPES.map((f) => (
              <button key={f} className={fabricType === f ? "unit-active" : ""} onClick={() => setFabricType(f)}>
                {FABRIC_LABELS[f]}
              </button>
            ))}
          </span>
        </h4>
        <p className="hint weights-total">
          {flyAreaM2.toFixed(2)} m² · {formatWeight(flyWeightGrams, weightUnit)} (
          {FABRIC_DENSITY_G_PER_M2[fabricType]} g/m² {FABRIC_LABELS[fabricType]})
        </p>
      </div>

      <p className="hint weights-total weights-grand-total">
        Total tent weight: {formatWeight(totalWeightGrams, weightUnit)}
      </p>

      <p className="hint pole-weight-hint">
        Pole weight assumes hollow 6061-T6 aluminium tubing, {DEFAULT_POLE_WALL_THICKNESS_MM}mm
        wall, {DEFAULT_POLE_DIAMETER_MM}mm diameter where a pole's own diameter isn't set. Fabric
        weight uses a single representative areal density per type (see geometry/fabricWeight.ts)
        rather than a per-panel material spec. Both are labeled estimates, not a bill of materials.
      </p>
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
      <WeightsSection design={design} />
    </div>
  );
}
