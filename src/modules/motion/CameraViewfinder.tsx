import { useFrame, Canvas, useThree } from "@react-three/fiber";
import * as THREE from "three";

/**
 * Renders `scene` through `camera` every frame via an explicit `gl.render`
 * call. A positive render priority opts this Canvas out of R3F's own default
 * auto-render of ITS OWN (empty) root scene — without it, the Canvas would
 * keep rendering its auto-created default camera/scene and this pip would
 * stay blank.
 *
 * Deliberately does NOT mount `scene` as a `<primitive>` child of this
 * Canvas's root: R3F's reconciler deletes `object.__r3f` on any `<primitive>`
 * whose object already carries that marker, to "regenerate" a fresh instance
 * for the new tree — and the main viewport's root scene already carries one
 * from its own Canvas. Reparenting it here would strip that bookkeeping from
 * the object the main viewport still depends on. Passing `scene` straight to
 * `gl.render()` sidesteps all of that: same live scene graph, no reparenting.
 */
function RenderThroughCamera({ scene, camera }: { scene: THREE.Scene; camera: THREE.Camera }) {
  const gl = useThree((s) => s.gl);
  useFrame(() => {
    gl.render(scene, camera);
  }, 1);
  return null;
}

interface CameraViewfinderProps {
  scene: THREE.Scene | null;
  camera: THREE.Camera | null;
}

/**
 * A live picture-in-picture render of the scene through the selected
 * cinematic camera. Reuses the SAME THREE.Scene instance the main viewport
 * renders (three.js doesn't restrict a scene graph to one renderer), so
 * anything the main viewport already shows — mannequins, primitives, lights,
 * keyframe-driven motion — shows up here automatically with no extra sync
 * code. Editor chrome (grid/gizmo/camera body/frustum helper) lives on layer
 * 1, which this camera never enables, so the preview only ever shows the real
 * shot content.
 */
export function CameraViewfinder({ scene, camera }: CameraViewfinderProps) {
  if (!scene || !camera) return null;
  return (
    <div style={{ width: "100%", aspectRatio: "16 / 9", background: "#000", borderRadius: 4, overflow: "hidden" }}>
      <Canvas frameloop="always" gl={{ antialias: true }}>
        <RenderThroughCamera scene={scene} camera={camera} />
      </Canvas>
    </div>
  );
}
