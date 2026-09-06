import * as THREE from "three";
import { useComposerStore } from "../../stores/composerStore";
import { CameraViewfinder } from "./CameraViewfinder";

interface CameraInspectorPanelProps {
  scene: THREE.Scene | null;
  cameraInstance: THREE.Camera | null;
}

const numberInputStyle = { width: 64 };
const rowStyle = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 };

/** Shown instead of PoseLibraryPanel when the selected object is a cinematic camera. */
export function CameraInspectorPanel({ scene, cameraInstance }: CameraInspectorPanelProps) {
  const selectedObjectId = useComposerStore((s) => s.selectedObjectId);
  const objects = useComposerStore((s) => s.objects);
  const updateObjectFov = useComposerStore((s) => s.updateObjectFov);

  const object = objects.find((o) => o.id === selectedObjectId);
  if (!object || object.type !== "camera") return null;

  return (
    <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 8 }}>
      <h3 className="pose-section-header">Camera</h3>
      <CameraViewfinder scene={scene} camera={cameraInstance} />
      <label style={rowStyle}>
        <span style={{ fontSize: 13 }}>Field of View</span>
        <input
          type="number" min={10} max={120} step={1}
          value={Math.round(object.fov ?? 10)}
          onChange={(e) => updateObjectFov(object.id, Number(e.target.value))}
          style={numberInputStyle}
        />
      </label>
    </div>
  );
}
