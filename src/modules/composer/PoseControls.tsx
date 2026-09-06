import { useEffect } from "react";
import * as THREE from "three";
import { useThree } from "@react-three/fiber";
import { JOINT_CONFIGS } from "./helpers/jointConfig";

/**
 * Click-to-select joints while the pose tool is active. Selection only — the
 * rotating belongs to TransformControls in JointGizmo.
 *
 * Joints are found by tagging every mesh under each joint's `imageWrapper` with
 * `userData.jointKey` and raycasting that flat list. Walking up the parent chain
 * from the hit mesh cannot work: a joint's `.name` is its class name ("Arm",
 * "Knee"), never the side-qualified key. Tagging in JOINT_CONFIGS order is what
 * makes nested joints resolve correctly — a child hangs off its parent's
 * wrapper, so the deeper joint, listed later, overwrites the parent's tag.
 */
interface PoseControlsProps {
  isPoseMode: boolean;
  figure: any | null;
  onJointSelect: (key: string | null) => void;
}

export default function PoseControls({ isPoseMode, figure, onJointSelect }: PoseControlsProps) {
  const { camera, gl } = useThree();

  useEffect(() => {
    if (!isPoseMode || !figure) return;

    const domElement = gl.domElement;
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();

    function onPointerDown(event: PointerEvent) {
      // Right and middle drag pan and dolly the camera, so they must never
      // repick the joint — panning across the figure would otherwise reselect
      // whatever it passed over, and panning off it would clear the selection.
      // Shift/Ctrl/Cmd + left is OrbitControls' own pan, so it is a camera move
      // too, not a pick.
      if (event.button !== 0 || event.shiftKey || event.ctrlKey || event.metaKey) return;

      // Non-null `axis` means the pointer is over a gizmo handle, so this press
      // starts a drag rather than a pick. Hover is resolved before pointerdown,
      // which makes this independent of listener order.
      if ((camera as any).__jointGizmo?.axis) return;

      const rect = domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);

      const meshes: THREE.Object3D[] = [];
      for (const { mannequinKey } of JOINT_CONFIGS) {
        figure[mannequinKey]?.imageWrapper?.traverse((child: any) => {
          if (child.isMesh) {
            child.userData.jointKey = mannequinKey;
            meshes.push(child);
          }
        });
      }

      const hit = raycaster.intersectObjects(meshes, false)[0];
      onJointSelect(hit ? (hit.object.userData.jointKey as string) : null);
    }

    domElement.addEventListener("pointerdown", onPointerDown);
    return () => domElement.removeEventListener("pointerdown", onPointerDown);
  }, [isPoseMode, figure, camera, gl, onJointSelect]);

  return null;
}
