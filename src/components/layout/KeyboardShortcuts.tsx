import { useEffect } from "react";
import { useTentStore } from "../../state/tentStore";
import { useSelectionStore } from "../../state/selectionStore";

const EDITABLE_TAGS = new Set(["INPUT", "TEXTAREA", "SELECT"]);

/**
 * Global Delete/Backspace-to-remove and Shift+D-to-duplicate for whatever's
 * currently selected in selectionStore. Renders nothing; reads store state
 * fresh on each keystroke rather than subscribing, since this only ever
 * fires from a DOM event, not a render.
 */
export function KeyboardShortcuts() {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (target && (EDITABLE_TAGS.has(target.tagName) || target.isContentEditable)) return;

      const selection = useSelectionStore.getState().selection;
      if (!selection) return;
      const store = useTentStore.getState();

      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        if (selection.kind === "anchor") {
          const anchor = store.design.anchors.find((a) => a.id === selection.id);
          if (anchor && (anchor.type === "stake" || anchor.type === "tie-out")) {
            store.removeAnchor(selection.id);
            useSelectionStore.getState().clear();
          }
        } else if (selection.kind === "joint") {
          store.removeJoint(selection.id);
          useSelectionStore.getState().clear();
        } else if (selection.kind === "segment") {
          store.removeSegment(selection.id);
          useSelectionStore.getState().clear();
        }
        return;
      }

      if (e.shiftKey && (e.key === "D" || e.key === "d")) {
        e.preventDefault();
        if (selection.kind === "anchor") {
          const anchor = store.design.anchors.find((a) => a.id === selection.id);
          if (anchor && (anchor.type === "stake" || anchor.type === "tie-out")) {
            store.duplicateAnchor(selection.id);
          }
        } else if (selection.kind === "joint") {
          store.duplicateJoint(selection.id);
        } else if (selection.kind === "segment") {
          store.duplicateSegment(selection.id);
        }
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return null;
}
