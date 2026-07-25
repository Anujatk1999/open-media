import { useLayoutEffect, useRef, useImperativeHandle, forwardRef } from "react";
import * as THREE from "three";
import type { ThreeEvent } from "@react-three/fiber";

import {
  createMannequin,
  type CharacterType,
} from "./helpers/mannequinFactory";

// Body part names for click-to-select in Pose Mode.
// Maps mesh children to their parent joint key on the mannequin.
const POSE_PARTS: [string, string[]][] = [
  ["head", ["head"]],
  ["neck", ["neck"]],
  ["torso", ["torso"]],
  ["body", ["body"]],
  ["pelvis", ["pelvis"]],
  ["l_arm", ["l_arm"]],
  ["l_elbow", ["l_elbow"]],
  ["l_wrist", ["l_wrist"]],
  ["l_leg", ["l_leg"]],
  ["l_knee", ["l_knee"]],
  ["l_ankle", ["l_ankle"]],
  ["r_arm", ["r_arm"]],
  ["r_elbow", ["r_elbow"]],
  ["r_wrist", ["r_wrist"]],
  ["r_leg", ["r_leg"]],
  ["r_knee", ["r_knee"]],
  ["r_ankle", ["r_ankle"]],
];

interface Props {
  id: string;
  type?: CharacterType;
  name?: string;
  position: [number, number, number];
  rotation: [number, number, number];
  posture?: { version: number; data: number[][] };
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

  useImperativeHandle(ref, () => ({
    root: root.current,
    mannequin: mannequinRef.current,
  }));

  // Create/replace mannequin when type changes
  useLayoutEffect(() => {
    const mannequin = createMannequin({ type });
    root.current.clear();
    root.current.add(mannequin);
    mannequinRef.current = mannequin;
    onReady?.(root.current);
  }, [type, onReady]);

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

  // Apply posture
  useLayoutEffect(() => {
    const m = mannequinRef.current as any;
    if (!m || !posture) return;
    try {
      m.posture = posture;
      m.updateMatrixWorld(true);
      if (typeof m.stepOnGround === "function") {
        m.stepOnGround();
      }
    } catch {
      // Silently ignore posture version mismatches on stale data
    }
  }, [posture]);

  // Selection highlight
  useLayoutEffect(() => {
    const m = mannequinRef.current as any;
    if (!m) return;
    if (typeof m.select === "function") {
      m.select(selected);
    }
  }, [selected]);

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