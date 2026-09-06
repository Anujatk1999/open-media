/**
 * Live "what the shot sees" box for the Shot Builder panel. Renders the SAME
 * scene the main viewport uses (shared THREE.Scene, passed in via
 * ComposerViewportAPI.getScene) through a second camera that mirrors the main
 * viewport's real camera every frame — never an independent solve. Grid/axes
 * and every transform/joint gizmo live on layer 1 in the main viewport (see
 * ComposerViewport.tsx, TransformGizmo.tsx, JointGizmo.tsx) and this camera
 * only ever sees the default layer 0, so none of that editor chrome leaks
 * into the preview.
 */
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { SHOT_CAMERA_NEAR, SHOT_CAMERA_FAR } from "../library/calibration/scene";

function PreviewCameraRig({ mainCamera }: { mainCamera: THREE.Camera | null }) {
  const { camera } = useThree();
  useFrame(() => {
    if (!mainCamera) return;
    camera.position.copy(mainCamera.position);
    camera.quaternion.copy(mainCamera.quaternion);
    if (
      mainCamera instanceof THREE.PerspectiveCamera &&
      camera instanceof THREE.PerspectiveCamera &&
      camera.fov !== mainCamera.fov
    ) {
      camera.fov = mainCamera.fov;
      camera.updateProjectionMatrix();
    }
  });
  return null;
}

export function ShotPreview({
  scene,
  camera,
  width,
  height,
}: {
  scene: THREE.Scene | null;
  camera: THREE.Camera | null;
  width: number;
  height: number;
}) {
  return (
    <div className="shot-preview" style={{ width, height }}>
      {scene ? (
        <Canvas scene={scene} dpr={[1, 1.5]} camera={{ near: SHOT_CAMERA_NEAR, far: SHOT_CAMERA_FAR }}>
          <PreviewCameraRig mainCamera={camera} />
        </Canvas>
      ) : (
        <div className="shot-preview-empty">Loading scene…</div>
      )}
    </div>
  );
}
