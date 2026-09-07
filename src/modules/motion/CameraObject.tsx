import { useLayoutEffect, useRef } from "react";
import * as THREE from "three";
import { useThree, useFrame } from "@react-three/fiber";
import type { ThreeEvent } from "@react-three/fiber";

interface CameraObjectProps {
  id: string;
  position: [number, number, number];
  rotation: [number, number, number];
  fov?: number;
  visible?: boolean;
  selected?: boolean;
  /** The scene's current viewing/export camera — tinted distinctly from a merely-selected one. */
  isActive?: boolean;
  registerInstance: (id: string, object: THREE.Object3D) => void;
  unregisterInstance: (id: string) => void;
  onReady?: (object: THREE.Object3D) => void;
  onSelect?: (id: string) => void;
}

/**
 * A selectable, keyframeable cinematic camera — a free body (position +
 * orientation + FOV), not an arm around a fixed pivot: `cam` is registered
 * and returned directly, at scene-root level, same contract as
 * PrimitiveObject/MannequinObject. AnimatedObject drives `cam.position`/
 * `cam.rotation` every frame exactly like it does for those, no special-cased
 * hierarchy to walk.
 *
 * A body-plus-lens mesh (child of `cam`) gives it a clickable, recognizable
 * shape, and a CameraHelper traces its frustum — both on layer 1 (editor
 * chrome), same as the grid/gizmo, so neither ever appears in this camera's
 * own render (export or sidebar viewfinder), since this camera itself never
 * enables layer 1.
 *
 * The CameraHelper draws a separate, purely-visual `helperCam` kept in
 * lockstep with `cam`'s world position/rotation/fov every frame but with its
 * own short, fixed `far` — CameraHelper always draws lines out to whatever
 * far plane it's given, so feeding it the real `cam` (far 1000, for actual
 * scene-appropriate render distance) would stretch lines far past anything
 * on screen.
 */
export default function CameraObject({
  id, position, rotation, fov, visible = true, selected = false, isActive = false,
  registerInstance, unregisterInstance, onReady, onSelect,
}: CameraObjectProps) {
  const cam = useRef(new THREE.PerspectiveCamera(fov ?? 10, 16 / 9, 0.1, 1000)).current;
  const helperCam = useRef(new THREE.PerspectiveCamera(fov ?? 10, 16 / 9, 0.1, 2)).current;
  const bodyRef = useRef<THREE.Mesh | null>(null);
  const helperRef = useRef<THREE.CameraHelper | null>(null);
  const { scene } = useThree();

  useLayoutEffect(() => {
    cam.name = id;

    // A recognizable body-plus-lens shape (rather than a plain box) so the
    // camera itself reads clearly in the viewport: a boxy body with a
    // cylindrical lens protruding out its front (-Z, the direction it looks).
    // MeshBasicMaterial (unlit) — layer-1 editor chrome is excluded from the
    // scene's own lights (Three.js filters lights by shared layer, same as
    // camera visibility), so a lit material here would render near-black.
    const body = new THREE.Group();
    const bodyGeometry = new THREE.BoxGeometry(0.34, 0.26, 0.32);
    const bodyMaterial = new THREE.MeshBasicMaterial({ color: 0x2563eb });
    const bodyMesh = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.add(bodyMesh);
    const lensGeometry = new THREE.CylinderGeometry(0.11, 0.13, 0.28, 16);
    const lensMaterial = new THREE.MeshBasicMaterial({ color: 0x111827 });
    const lensMesh = new THREE.Mesh(lensGeometry, lensMaterial);
    lensMesh.rotation.x = Math.PI / 2;
    lensMesh.position.set(0, 0, -0.28);
    body.add(lensMesh);
    body.layers.set(1);
    bodyMesh.layers.set(1);
    lensMesh.layers.set(1);
    cam.add(body);
    bodyRef.current = bodyMesh;

    scene.add(helperCam);
    const helper = new THREE.CameraHelper(helperCam);
    helper.layers.set(1);
    scene.add(helper);
    helperRef.current = helper;

    registerInstance(id, cam);
    onReady?.(cam);

    return () => {
      unregisterInstance(id);
      scene.remove(helper);
      helper.dispose();
      scene.remove(helperCam);
      cam.remove(body);
      bodyGeometry.dispose();
      bodyMaterial.dispose();
      lensGeometry.dispose();
      lensMaterial.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, scene, cam, helperCam]);

  // Applies the initial placement once at mount — animated updates thereafter
  // come from AnimatedObject's useFrame writing straight onto `cam`, same as
  // PrimitiveObject/MannequinObject.
  useLayoutEffect(() => {
    cam.position.set(...position);
    cam.rotation.set(...rotation);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cam]);

  useLayoutEffect(() => {
    if (fov !== undefined && cam.fov !== fov) {
      cam.fov = fov;
      cam.updateProjectionMatrix();
    }
  }, [cam, fov]);

  useLayoutEffect(() => {
    const body = bodyRef.current;
    if (!body) return;
    // Selection (editing) wins visually over active (viewing) when both apply.
    const color = selected ? 0x60a5fa : isActive ? 0x22c55e : 0x2563eb;
    (body.material as THREE.MeshBasicMaterial).color.set(color);
  }, [selected, isActive]);

  useFrame(() => {
    if (helperCam.fov !== cam.fov || helperCam.aspect !== cam.aspect) {
      helperCam.fov = cam.fov;
      helperCam.aspect = cam.aspect;
      helperCam.updateProjectionMatrix();
    }
    cam.updateWorldMatrix(true, false);
    helperCam.position.setFromMatrixPosition(cam.matrixWorld);
    helperCam.quaternion.setFromRotationMatrix(cam.matrixWorld);
    helperCam.updateMatrixWorld(true);
    helperRef.current?.update();
  });

  return (
    <primitive
      object={cam}
      visible={visible}
      onClick={(e: ThreeEvent<MouseEvent>) => {
        e.stopPropagation();
        onSelect?.(id);
      }}
    />
  );
}
