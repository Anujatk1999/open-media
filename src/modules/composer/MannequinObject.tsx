import { useLayoutEffect, useRef, useImperativeHandle, forwardRef } from "react";
import * as THREE from "three";
import type { ThreeEvent } from "@react-three/fiber";

import {
  createMannequin,
  type CharacterType,
} from "./helpers/mannequinFactory";

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

  // Apply transform
  useLayoutEffect(() => {
    root.current.position.set(position[0], position[1], position[2]);
    root.current.rotation.set(rotation[0], rotation[1], rotation[2]);
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