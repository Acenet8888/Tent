import { useMemo } from "react";
import { useTentStore } from "../../state/tentStore";
import { validateTentDesign } from "../../validation/validateTentDesign";
import { FloorPlanEditor } from "../editor2d/FloorPlanEditor";
import { TentScene } from "../editor3d/TentScene";
import { DesignControls } from "../panels/DesignControls";
import { ObjectProperties } from "../panels/ObjectProperties";
import { ViewControls } from "../panels/ViewControls";
import { ComponentList } from "../panels/ComponentList";
import { CutPatternModal } from "../panels/CutPatternModal";
import { KeyboardShortcuts } from "./KeyboardShortcuts";

export function EditorLayout() {
  const design = useTentStore((s) => s.design);
  const issues = useMemo(() => validateTentDesign(design), [design]);
  const errorCount = issues.filter((i) => i.severity === "error").length;
  const warningCount = issues.filter((i) => i.severity === "warning").length;

  return (
    <div className="editor-layout">
      <header className="editor-topbar">
        <h1>Tent Designer</h1>
        <div className="validation-summary" title={issues.map((i) => i.message).join("\n")}>
          {errorCount > 0 && <span className="badge badge-error">{errorCount} error{errorCount === 1 ? "" : "s"}</span>}
          {warningCount > 0 && (
            <span className="badge badge-warning">
              {warningCount} warning{warningCount === 1 ? "" : "s"}
            </span>
          )}
          {errorCount === 0 && warningCount === 0 && <span className="badge badge-ok">Design valid</span>}
        </div>
      </header>

      <div className="editor-body">
        <aside className="editor-sidebar-left">
          <DesignControls />
          <ObjectProperties />
        </aside>

        <main className="editor-viewports">
          <div className="viewport viewport-2d">
            <div className="viewport-label">2D Floor Plan</div>
            <FloorPlanEditor />
          </div>
          <div className="viewport viewport-3d">
            <div className="viewport-label">3D View</div>
            <TentScene />
          </div>
        </main>

        <aside className="editor-sidebar-right">
          <ComponentList />
          <ViewControls />
        </aside>
      </div>

      <CutPatternModal />
      <KeyboardShortcuts />
    </div>
  );
}
