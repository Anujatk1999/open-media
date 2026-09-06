import { useComposerStore, selectCanPose } from "../../stores/composerStore";
import ToolButtons from "./ToolButtons";

export default function WorkspaceToolbar() {
  const activeTool = useComposerStore(s => s.activeTool);
  const setActiveTool = useComposerStore(s => s.setActiveTool);
  const canPose = useComposerStore(selectCanPose);

  return <ToolButtons activeTool={activeTool} canPose={canPose} onToolChange={setActiveTool} />;
}
