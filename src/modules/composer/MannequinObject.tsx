import { useLayoutEffect, useRef, useImperativeHandle, forwardRef } from "react";
import * as THREE from "three";
import type { ThreeEvent } from "@react-three/fiber";

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
  scale?: [number, number, number];
  posture?: Posture;
  visible?: boolean;
  selected?: boolean;
  registerInstance: (id: string, object: THREE.Object3D) => void;
  unregisterInstance: (id: string) => void;
  onDefaultPosture: (id: string, posture: Posture) => void;
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
    scale = [1, 1, 1],
    posture,
    visible = true,
    selected = false,
    registerInstance,
    unregisterInstance,
    onDefaultPosture,
    onReady,
    onSelect,
  }: Props,
  ref
) {
  const root = useRef(new THREE.Group());
  const mannequinRef = useRef<THREE.Object3D | null>(null);
  // `posture` is only used as a fallback when Undo/Redo re-creates the figure
  // mid-build (see below) — a ref keeps that read live without pulling the
  // store in here directly.
  const postureRef = useRef<Posture | undefined>(posture);
  postureRef.current = posture;

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
    createMannequin({ type }).then(mannequin => {
      if (!mounted) return;
      root.current.clear();
      root.current.add(mannequin);
      mannequinRef.current = mannequin;
      registerInstance(id, mannequin);
      onReady?.(root.current);

      // Capture the default posture after mannequin is fully initialized
      // The mannequin-js constructor sets up the default pose with non-zero values
      onDefaultPosture(id, readPosture(mannequin));

      // A figure re-created by Undo must come back in its stored pose. The
      // posture effect below cannot do it: it already ran, before this async
      // build produced a figure to write to, and its dep has not changed since.
      const stored = postureRef.current;
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

  // Apply transform — only if the value actually differs from current.
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
    const s = root.current.scale;
    if (s.x !== scale[0] || s.y !== scale[1] || s.z !== scale[2]) {
      s.set(scale[0], scale[1], scale[2]);
    }
  }, [position, rotation, scale]);

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
        onSelect?.(id);
      }}
    />
  );
});

export default MannequinObject;