export type GizmoTool = "move" | "rotate" | "scale" | "pose";

interface ToolButtonsProps {
  activeTool: string;
  canPose: boolean;
  onToolChange: (tool: GizmoTool) => void;
}

export default function ToolButtons({ activeTool, canPose, onToolChange }: ToolButtonsProps) {
  return (
    <div className="workspace-toolbar-tools">
      <button
        className={activeTool === "move" ? "on" : ""}
        onClick={() => onToolChange("move")}
        title="Move (Translate)"
      >
        Move
      </button>
      <button
        className={activeTool === "rotate" ? "on" : ""}
        onClick={() => onToolChange("rotate")}
        title="Rotate"
      >
        Rotate
      </button>
      <button
        className={activeTool === "scale" ? "on" : ""}
        onClick={() => onToolChange("scale")}
        title="Scale"
      >
        Scale
      </button>
      <button
        className={activeTool === "pose" ? "on" : ""}
        onClick={() => onToolChange("pose")}
        disabled={!canPose}
        title={canPose ? "Pose (rotate body parts)" : "Pose applies to mannequins only"}
      >
        Pose
      </button>
    </div>
  );
}
