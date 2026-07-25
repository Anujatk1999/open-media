import { useEffect, useRef } from "react";
import { TransformControls } from "@react-three/drei";
import type { TransformControls as TransformControlsType } from "three-stdlib";
import * as THREE from "three";
import { useThree } from "@react-three/fiber";
import { useComposerStore, type ComposerTool } from "../../stores/composerStore";

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

  // Sync mode from store (only for move/rotate, pose is handled separately)
  useEffect(() => {
    if (!controlsRef.current) return;
    if (activeTool === "move") controlsRef.current.setMode("translate");
    else if (activeTool === "rotate") controlsRef.current.setMode("rotate");
  }, [activeTool]);

  // Track drag state explicitly — don't rely on controls.enabled timing.
  const isDraggingRef = useRef(false);
  const pendingUpdate = useRef<{ position: [number, number, number]; rotation: [number, number, number] } | null>(null);

  useEffect(() => {
    const ctrl = controlsRef.current;
    if (!ctrl) return;

    const onStart = () => {
      isDraggingRef.current = true;
      pendingUpdate.current = null;
      const orbit = (camera as any)?.__orbitControls;
      if (orbit) orbit.enabled = false;
      onDragStart?.();
    };

    const onStop = () => {
      isDraggingRef.current = false;
      if (pendingUpdate.current && selectedId) {
        updateTransform(selectedId, pendingUpdate.current);
        pendingUpdate.current = null;
      }
      const orbit = (camera as any)?.__orbitControls;
      if (orbit) orbit.enabled = true;
      onDragEnd?.();
    };

    // Accumulate live changes for Inspector feedback during drag.
    const onChange = () => {
      if (!target || !selectedId) return;
      const pos = target.position;
      const rot = target.rotation;
      const snapshot = {
        position: [pos.x, pos.y, pos.z] as [number, number, number],
        rotation: [rot.x, rot.y, rot.z] as [number, number, number],
      };
      pendingUpdate.current = snapshot;
      updateTransform(selectedId, snapshot);
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

  // When store changes from Inspector, re-attach TransformControls so it
  // picks up the new position. Only re-attach when NOT dragging.
  useEffect(() => {
    if (isDraggingRef.current) return;
    const ctrl = controlsRef.current;
    if (!ctrl || !target || selected?.locked) return;
    if ((ctrl as any).object === target) {
      ctrl.detach();
      ctrl.attach(target);
    }
  }, [selected?.transform.position, selected?.transform.rotation, target]);

  // Don't show TransformGizmo in Pose mode — pose editing is independent
  if (activeTool === "pose" || !target || isLocked) return null;

  return (
    <TransformControls
      ref={controlsRef}
      object={target}
      mode={activeTool === "move" ? "translate" : "rotate"}
      space="world"
      size={1.0}
    />
  );
}