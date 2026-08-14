import { useLayoutEffect, useRef, useImperativeHandle, forwardRef } from "react";
import * as THREE from "three";
import type { ThreeEvent } from "@react-three/fiber";
import { useComposerStore } from "../../stores/composerStore";

export type PrimitiveType = "cube" | "plane" | "cylinder" | "sphere" | "capsule" | "cone" | "torus";

interface Props {
  id: string;
  type: PrimitiveType;
  name?: string;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
  visible?: boolean;
  selected?: boolean;
  onReady?: (object: THREE.Object3D) => void;
  onSelect?: (id: string) => void;
}

export interface PrimitiveHandle {
  root: THREE.Group;
  mesh: THREE.Mesh | null;
}

const PrimitiveObject = forwardRef<PrimitiveHandle, Props>(
  function PrimitiveObject(
    {
      id,
      type,
      position,
      rotation,
      scale,
      visible = true,
      selected = false,
      onReady,
      onSelect,
    }: Props,
    ref
  ) {
    const root = useRef(new THREE.Group());
    const meshRef = useRef<THREE.Mesh | null>(null);
    const geometryRef = useRef<THREE.BufferGeometry | null>(null);
    const registerInstance = useComposerStore((s) => s.registerObjectInstance);
    const unregisterInstance = useComposerStore((s) => s.unregisterObjectInstance);

    useImperativeHandle(ref, () => ({
      root: root.current,
      mesh: meshRef.current,
    }));

    // Create geometry based on type
    useLayoutEffect(() => {
      let geometry: THREE.BufferGeometry;

      switch (type) {
        case "cube":
          geometry = new THREE.BoxGeometry(1, 1, 1);
          break;
        case "plane":
          geometry = new THREE.PlaneGeometry(1, 1);
          break;
        case "cylinder":
          geometry = new THREE.CylinderGeometry(0.5, 0.5, 1, 32);
          break;
        case "sphere":
          geometry = new THREE.SphereGeometry(0.5, 32, 32);
          break;
        case "capsule":
          geometry = new THREE.CapsuleGeometry(0.5, 1, 8, 16);
          break;
        case "cone":
          geometry = new THREE.ConeGeometry(0.5, 1, 32);
          break;
        case "torus":
          geometry = new THREE.TorusGeometry(0.5, 0.2, 16, 32);
          break;
        default:
          geometry = new THREE.BoxGeometry(1, 1, 1);
      }

      geometryRef.current = geometry;

      const material = new THREE.MeshStandardMaterial({
        color: 0x888888,
        roughness: 0.7,
        metalness: 0.1,
      });

      const mesh = new THREE.Mesh(geometry, material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.name = id;

      // Ground the primitive at Y=0 (bottom of bounding box on grid)
      geometry.computeBoundingBox();
      if (geometry.boundingBox) {
        mesh.position.y = -geometry.boundingBox.min.y;
      }

      root.current.clear();
      root.current.add(mesh);
      meshRef.current = mesh;

      registerInstance(id, root.current);
      onReady?.(root.current);

      return () => {
        unregisterInstance(id);
        geometry.dispose();
        material.dispose();
      };
    }, [type, id, onReady, registerInstance, unregisterInstance]);

    // Apply transform
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

    // Selection highlight
    useLayoutEffect(() => {
      const mesh = meshRef.current;
      if (!mesh) return;
      const mat = mesh.material as THREE.MeshStandardMaterial;
      if (selected) {
        mat.emissive.set(0x333300);
      } else {
        mat.emissive.set(0x000000);
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
  }
);

export default PrimitiveObject;