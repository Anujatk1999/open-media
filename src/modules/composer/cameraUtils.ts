import * as THREE from 'three';
import type { OrbitControls as OrbitControlsType } from 'three-stdlib';

export type EditorView =
  | 'front'
  | 'back'
  | 'left'
  | 'right'
  | 'top'
  | 'bottom'
  | 'front-left'
  | 'front-right'
  | 'back-left'
  | 'back-right'
  | 'isometric'
  | 'perspective';

export function getObjectBounds(object: THREE.Object3D) {
  object.updateWorldMatrix(true, true);
  return new THREE.Box3().setFromObject(object);
}

export function frameObject(camera: THREE.PerspectiveCamera, controls: OrbitControlsType, object: THREE.Object3D, direction = new THREE.Vector3(1, .55, 1), fill = .62) {
  const box = getObjectBounds(object);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const radius = Math.max(size.x, size.y, size.z) / 2;
  const distance = radius / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) / fill;
  controls.target.copy(center);
  camera.position.copy(center).add(direction.normalize().multiplyScalar(distance));
  camera.up.set(0, 1, 0);
  camera.lookAt(center);
  camera.updateProjectionMatrix();
  controls.update();
}

export function setEditorView(camera: THREE.PerspectiveCamera, controls: OrbitControlsType, object: THREE.Object3D, view: EditorView) {
  const directions: Record<EditorView, THREE.Vector3> = {
    'front': new THREE.Vector3(0, .08, 1),
    'back': new THREE.Vector3(0, .08, -1),
    'left': new THREE.Vector3(-1, .08, 0),
    'right': new THREE.Vector3(1, .08, 0),
    'top': new THREE.Vector3(0, 1, .001),
    'bottom': new THREE.Vector3(0, -1, .001),
    'front-left': new THREE.Vector3(-1, .08, 1),
    'front-right': new THREE.Vector3(1, .08, 1),
    'back-left': new THREE.Vector3(-1, .08, -1),
    'back-right': new THREE.Vector3(1, .08, -1),
    'isometric': new THREE.Vector3(1, 1, 1),
    'perspective': new THREE.Vector3(1, .55, 1),
  };

  const direction = directions[view] || directions['perspective'];

  // Get the object's bounding sphere to check for collisions
  const box = getObjectBounds(object);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const boundingRadius = Math.max(size.x, size.y, size.z) / 2;

  // Preserve current camera distance from target
  const currentDistance = camera.position.distanceTo(controls.target);

  // Use current distance if it's reasonable, otherwise compute a safe distance
  // Minimum distance: bounding radius + safety margin
  const minDistance = boundingRadius * 1.2;
  const distance = Math.max(currentDistance, minDistance);

  // Position camera at the new angle but preserving distance
  controls.target.copy(center);
  camera.position.copy(center).add(direction.normalize().multiplyScalar(distance));

  // Set up vector based on view
  if (view === 'top') {
    camera.up.set(0, 0, -1);
  } else if (view === 'bottom') {
    camera.up.set(0, 0, 1);
  } else {
    camera.up.set(0, 1, 0);
  }

  camera.lookAt(controls.target);
  camera.updateProjectionMatrix();
  controls.update();
}
