import { useEffect, useRef } from "react";
import { TransformControls } from "@react-three/drei";
import type { TransformControls as TransformControlsType } from "three-stdlib";
import * as THREE from "three";
import { useThree } from "@react-three/fiber";
import { useComposerStore, type ComposerTool, type SceneObject } from "../../stores/composerStore";

interface TransformGizmoProps {
  target: THREE.Object3D | null;
  onDragStart?: () => void;
  onDragEnd?: () => void;
}

export default function TransformGizmo({ target, onDragStart, onDragEnd }: TransformGizmoProps) {
  const controlsRef = useRef<TransformControlsType>(null);
  const activeTool = useComposerStore(s => s.activeTool);
  const selectedId = useComposerStore(s => s.selectedObjectId);
  const objects = useComposerStore(s => s.objects);
  const updateTransform = useComposerStore(s => s.updateObjectTransform);
  const { camera } = useThree();

  const selected = objects.find(m => m.id === selectedId);
  const isLocked = selected?.locked ?? true;

  /**
   * The store's tool is the only source of truth for which gizmo is showing.
   *
   * This used to be pushed imperatively with `setMode` from an effect keyed on
   * `[activeTool, controlsRef.current]`, which desynced whenever the controls
   * mounted rather than the tool changed: a ref reads as its *pre-commit* value
   * during render, so on the render that first shows the gizmo the dep was still
   * `null` — unchanged — and the effect never ran. The gizmo therefore came up in
   * its constructor default (translate) every time it mounted under an already
   * active Rotate or Scale, i.e. on selecting an object, unlocking one, or
   * leaving pose mode. Passing `mode` as a prop lets R3F apply it on mount and on
   * every change, and `mode` is a defined property on TransformControls whose
   * setter swaps the handle set — so the previous mode's gizmo is always torn
   * down before the new one attaches.
   */
  const mode = activeTool === "rotate" ? "rotate" : activeTool === "scale" ? "scale" : "translate";

  // Track drag state explicitly — don't rely on controls.enabled timing.
  const isDraggingRef = useRef(false);
  const pendingUpdate = useRef<{ position: [number, number, number]; rotation: [number, number, number]; scale: [number, number, number] } | null>(null);

  useEffect(() => {
    const ctrl = controlsRef.current;
    if (!ctrl) return;

    const { beginHistoryGroup, endHistoryGroup } = useComposerStore.getState();

    const onStart = () => {
      isDraggingRef.current = true;
      pendingUpdate.current = null;
      beginHistoryGroup(); // the whole drag is one undo step, not one per frame
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
      endHistoryGroup(); // after the final write, so it stays inside the group
      const orbit = (camera as any)?.__orbitControls;
      if (orbit) orbit.enabled = true;
      onDragEnd?.();
    };

    // Accumulate live changes for Inspector feedback during drag.
    const onChange = () => {
      if (!target || !selectedId) return;
      const pos = target.position;
      const rot = target.rotation;
      const scl = target.scale;
      const snapshot = {
        position: [pos.x, pos.y, pos.z] as [number, number, number],
        rotation: [rot.x, rot.y, rot.z] as [number, number, number],
        scale: [scl.x, scl.y, scl.z] as [number, number, number],
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
      // Unmounting mid-drag (a tool switch, say) skips mouseUp, which would
      // otherwise leave the history group open and swallow every later edit —
      // and leave OrbitControls disabled, killing orbit and pan for good, since
      // nothing else ever writes `enabled` back: it is not a prop drei manages,
      // so no re-render restores it.
      if (isDraggingRef.current) {
        isDraggingRef.current = false;
        endHistoryGroup();
        const orbit = (camera as any)?.__orbitControls;
        if (orbit) orbit.enabled = true;
      }
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
  }, [selected?.transform.position, selected?.transform.rotation, selected?.transform.scale, target]);

  // Don't show TransformGizmo in Pose mode — pose editing is independent
  if (activeTool === "pose" || !target || isLocked) return null;

  return (
    <TransformControls
      ref={controlsRef}
      object={target}
      mode={mode}
      space="world"
      size={1.0}
    />
  );
}