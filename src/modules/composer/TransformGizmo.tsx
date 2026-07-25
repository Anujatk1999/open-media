import { useEffect, useRef } from "react";
import { TransformControls } from "@react-three/drei";
import type { TransformControls as TransformControlsType } from "three-stdlib";
import * as THREE from "three";
import { useThree } from "@react-three/fiber";
import { useComposerStore } from "../../stores/composerStore";

interface TransformGizmoProps {
  target: THREE.Object3D | null;
  onDragStart?: () => void;
  onDragEnd?: () => void;
}

export default function TransformGizmo({ target, onDragStart, onDragEnd }: TransformGizmoProps) {
  const controlsRef = useRef<TransformControlsType>(null);
  const activeTool = useComposerStore(s => s.activeTool);
  const selectedId = useComposerStore(s => s.selectedMannequinId);
  const mannequins = useComposerStore(s => s.mannequins);
  const updateTransform = useComposerStore(s => s.updateMannequinTransform);
  const { camera } = useThree();

  const selected = mannequins.find(m => m.id === selectedId);
  const isLocked = selected?.locked ?? true;

  // Sync mode from store
  useEffect(() => {
    if (!controlsRef.current) return;
    controlsRef.current.setMode(activeTool === "move" ? "translate" : "rotate");
  }, [activeTool]);

  // Disable orbit controls while dragging
  useEffect(() => {
    const ctrl = controlsRef.current;
    if (!ctrl) return;

    const onStart = () => {
      (ctrl as any).enabled = false;
      // Also disable OrbitControls
      const orbit = (camera as any)?.__orbitControls;
      if (orbit) orbit.enabled = false;
      onDragStart?.();
    };

    const onStop = () => {
      (ctrl as any).enabled = true;
      const orbit = (camera as any)?.__orbitControls;
      if (orbit) orbit.enabled = true;
      onDragEnd?.();
    };

    const onChange = () => {
      if (!target || !selectedId) return;
      // Re-read transform from the group so we don't accumulate floating-point drift
      const pos = target.position;
      const rot = target.rotation;
      updateTransform(selectedId, {
        position: [parseFloat(pos.x.toFixed(4)), parseFloat(pos.y.toFixed(4)), parseFloat(pos.z.toFixed(4))],
        rotation: [parseFloat(rot.x.toFixed(4)), parseFloat(rot.y.toFixed(4)), parseFloat(rot.z.toFixed(4))],
      });
    };

    (ctrl as any).addEventListener("mouseDown", onStart);
    (ctrl as any).addEventListener("mouseUp", onStop);
    (ctrl as any).addEventListener("objectChange", onChange);

    return () => {
      (ctrl as any).removeEventListener("mouseDown", onStart);
      (ctrl as any).removeEventListener("mouseUp", onStop);
      (ctrl as any).removeEventListener("objectChange", onChange);
    };
  }, [target, selectedId, updateTransform, camera, onDragStart, onDragEnd]);

  if (!target || isLocked) return null;

  return (
    <TransformControls
      ref={controlsRef}
      object={target}
      mode={activeTool === "move" ? "translate" : "rotate"}
      size={1.0}
    />
  );
}