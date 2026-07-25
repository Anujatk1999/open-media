import { useComposerStore } from "../../stores/composerStore";

export default function WorkspaceToolbar() {
  const activeTool = useComposerStore(s => s.activeTool);
  const setActiveTool = useComposerStore(s => s.setActiveTool);

  return (
    <div className="workspace-toolbar-tools">
      <button
        className={activeTool === "move" ? "on" : ""}
        onClick={() => setActiveTool("move")}
        title="Move (Translate)"
      >
        Move
      </button>
      <button
        className={activeTool === "rotate" ? "on" : ""}
        onClick={() => setActiveTool("rotate")}
        title="Rotate"
      >
        Rotate
      </button>
    </div>
  );
}