import { useComposerStore, selectCanPose } from "../../stores/composerStore";

export default function WorkspaceToolbar() {
  const activeTool = useComposerStore(s => s.activeTool);
  const setActiveTool = useComposerStore(s => s.setActiveTool);
  const canPose = useComposerStore(selectCanPose);

  return (
    <div className="workspace-toolbar-tools">
      <button
        className={activeTool === "move" ? "on" : ""}
        onClick={() => { console.log("[WorkspaceToolbar] tool → move"); setActiveTool("move"); }}
        title="Move (Translate)"
      >
        Move
      </button>
      <button
        className={activeTool === "rotate" ? "on" : ""}
        onClick={() => { console.log("[WorkspaceToolbar] tool → rotate"); setActiveTool("rotate"); }}
        title="Rotate"
      >
        Rotate
      </button>
      <button
        className={activeTool === "scale" ? "on" : ""}
        onClick={() => { console.log("[WorkspaceToolbar] tool → scale"); setActiveTool("scale"); }}
        title="Scale"
      >
        Scale
      </button>
      <button
        className={activeTool === "pose" ? "on" : ""}
        onClick={() => { console.log("[WorkspaceToolbar] tool → pose"); setActiveTool("pose"); }}
        disabled={!canPose}
        title={canPose ? "Pose (rotate body parts)" : "Pose applies to mannequins only"}
      >
        Pose
      </button>
    </div>
  );
}