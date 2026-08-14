import { useLayoutEffect, useRef, useImperativeHandle, forwardRef } from "react";
import * as THREE from "three";
import type { ThreeEvent } from "@react-three/fiber";
import { useComposerStore } from "../../stores/composerStore";

import {
  createMannequin,
  removeMannequinCanvases,
  type CharacterType,
} from "./helpers/mannequinFactory";
import { describePostureError, readPosture, writePosture, type Posture } from "./helpers/posture";

interface Props {
  id: string;
  type?: CharacterType;
  name?: string;
  position: [number, number, number];
  rotation: [number, number, number];
  posture?: Posture;
  visible?: boolean;
  selected?: boolean;
  onReady?: (object: THREE.Object3D) => void;
  onSelect?: (id: string) => void;
}

export interface MannequinHandle {
  /** The root THREE.Group containing the mannequin */
  root: THREE.Group;
  /** The mannequin-js Mannequin instance (for direct joint manipulation) */
  mannequin: THREE.Object3D | null;
}

const MannequinObject = forwardRef<MannequinHandle, Props>(function MannequinObject(
  {
    id,
    type = "male",
    position,
    rotation,
    posture,
    visible = true,
    selected = false,
    onReady,
    onSelect,
  }: Props,
  ref
) {
  const root = useRef(new THREE.Group());
  const mannequinRef = useRef<THREE.Object3D | null>(null);
  const registerInstance = useComposerStore(s => s.registerObjectInstance);
  const unregisterInstance = useComposerStore(s => s.unregisterObjectInstance);

  useImperativeHandle(ref, () => ({
    root: root.current,
    mannequin: mannequinRef.current,
  }));

  // Create/replace mannequin when type changes.
  // The store registry holds the mannequin itself, not `root` — every consumer
  // reaches for `.posture` or a joint key, neither of which the wrapper Group
  // carries.
  useLayoutEffect(() => {
    let mounted = true;
    const updateDefaultPosture = useComposerStore.getState().updateObjectDefaultPosture;
    createMannequin({ type }).then(mannequin => {
      if (!mounted) return;
      root.current.clear();
      root.current.add(mannequin);
      mannequinRef.current = mannequin;
      registerInstance(id, mannequin);
      onReady?.(root.current);

      // Capture the default posture after mannequin is fully initialized
      // The mannequin-js constructor sets up the default pose with non-zero values
      updateDefaultPosture(id, readPosture(mannequin));

      // A figure re-created by Undo must come back in its stored pose. The
      // posture effect below cannot do it: it already ran, before this async
      // build produced a figure to write to, and its dep has not changed since.
      const stored = useComposerStore.getState().objects.find(o => o.id === id)?.posture;
      if (stored) writePosture(mannequin, stored);
    });
    return () => {
      mounted = false;
      unregisterInstance(id);
      // Remove any canvas injected by mannequin-js when this component unmounts.
      // This prevents orphaned full-screen canvases covering other routes.
      removeMannequinCanvases();
    };
  }, [type, id, onReady, registerInstance, unregisterInstance]);

  // Apply transform — only if the position actually differs from current.
  // This prevents fighting with TransformControls during gizmo drag.
  useLayoutEffect(() => {
    const p = root.current.position;
    if (p.x !== position[0] || p.y !== position[1] || p.z !== position[2]) {
      p.set(position[0], position[1], position[2]);
    }
    const r = root.current.rotation;
    if (r.x !== rotation[0] || r.y !== rotation[1] || r.z !== rotation[2]) {
      r.set(rotation[0], rotation[1], rotation[2]);
    }
  }, [position, rotation]);

  // Apply posture — never re-ground here. Grounding moves the whole rig, so
  // doing it per posture write would fight a live gizmo drag. The actions that
  // do want it (Ground, Reset Pose, applyPosture, motion frames) call
  // groundFigure() themselves.
  useLayoutEffect(() => {
    const m = mannequinRef.current as any;
    if (!m || !posture) return;
    const error = describePostureError(posture);
    if (error) {
      console.error(`[MannequinObject] ignoring invalid posture: ${error}`);
      return;
    }
    writePosture(m, posture);
  }, [posture]);

  // Selection highlight — handled per-joint by JointGizmo.

  return (
    <primitive
      object={root.current}
      visible={visible}
      onClick={(e: ThreeEvent<MouseEvent>) => {
        e.stopPropagation();
        console.log("[MannequinObject] body clicked, id:", id, "type:", type);
        onSelect?.(id);
      }}
    />
  );
});

export default MannequinObject;