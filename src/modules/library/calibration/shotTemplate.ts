/**
 * Shot Template — a camera's spatial relationship to a subject group,
 * normalized against that group's own bounding radius so it can be replayed
 * after the subjects move or scale (not rotate — see referenceFrame below).
 *
 * `subjects` is a plain THREE.Object3D array everywhere in this file: capture
 * and regeneration never assume "both mannequins + table." Today's caller
 * (CalibrationViewport) happens to pass that group; a future single-character
 * or multi-selection caller passes a different array and everything here
 * still works.
 */
import * as THREE from "three";
import { getObjectBounds } from "../../composer/cameraUtils";

/**
 * Only "world" exists today: direction/targetOffsetRatio are world-space
 * vectors, so a *rotated* subject group would no longer reproduce the same
 * relative angle. Upgrading to a "subject" frame — storing those vectors in
 * the subject group's local rotation and rotating them back out in
 * regenerateFromTemplate — is the upgrade path once rotation needs to round-trip.
 * Not built now: the requested test covers translation and scale only.
 */
export type ShotReferenceFrame = "world";

export interface ShotTemplate {
  subjectIds: string[];
  referenceFrame: ShotReferenceFrame;
  fov: number;
  distanceRatio: number;
  direction: [number, number, number];
  targetOffsetRatio: [number, number, number];
}

export function getSubjectBounds(subjects: THREE.Object3D[]): THREE.Box3 {
  if (subjects.length === 0) throw new Error("[calibration] getSubjectBounds: no subjects given");
  const box = getObjectBounds(subjects[0]);
  for (let i = 1; i < subjects.length; i++) box.union(getObjectBounds(subjects[i]));
  return box;
}

export function captureShotTemplate(
  camera: THREE.PerspectiveCamera,
  target: THREE.Vector3,
  subjects: THREE.Object3D[],
  subjectIds: string[]
): ShotTemplate {
  const box = getSubjectBounds(subjects);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const radius = Math.max(size.x, size.y, size.z) / 2 || 1;

  const toCamera = camera.position.clone().sub(center);
  const distance = toCamera.length();
  const direction = toCamera.normalize();
  const targetOffset = target.clone().sub(center).divideScalar(radius);

  return {
    subjectIds,
    referenceFrame: "world",
    fov: camera.fov,
    distanceRatio: distance / radius,
    direction: [direction.x, direction.y, direction.z],
    targetOffsetRatio: [targetOffset.x, targetOffset.y, targetOffset.z],
  };
}

export interface RegeneratedShot {
  position: THREE.Vector3;
  target: THREE.Vector3;
  fov: number;
}

export function regenerateFromTemplate(template: ShotTemplate, subjects: THREE.Object3D[]): RegeneratedShot {
  const box = getSubjectBounds(subjects);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const radius = Math.max(size.x, size.y, size.z) / 2 || 1;

  const direction = new THREE.Vector3(...template.direction);
  const position = center.clone().add(direction.multiplyScalar(template.distanceRatio * radius));
  const offset = new THREE.Vector3(...template.targetOffsetRatio).multiplyScalar(radius);
  const target = center.clone().add(offset);

  return { position, target, fov: template.fov };
}

/**
 * The one runnable check for this module — no test framework in this repo.
 * Confirms the round trip the task asked for: translate the subject, then
 * scale it, and verify the regenerated camera preserves the same relative
 * offset/distance each time. Rotation is out of scope (see ShotReferenceFrame).
 */
export function assertShotTemplateRoundTrip(): void {
  const makeSubject = () => {
    const obj = new THREE.Object3D();
    obj.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1)));
    obj.updateWorldMatrix(true, true);
    return obj;
  };
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
  camera.position.set(2, 1, 2);
  const target = new THREE.Vector3(0, 0, 0);
  const originalOffset = new THREE.Vector3(2, 1, 2);
  const originalDistance = camera.position.length();

  // Translation case.
  const translated = makeSubject();
  const t1 = captureShotTemplate(camera, target, [translated], ["synthetic"]);
  translated.position.set(5, 0, -3);
  translated.updateWorldMatrix(true, true);
  const r1 = regenerateFromTemplate(t1, [translated]);
  console.assert(
    r1.position.distanceTo(translated.position.clone().add(originalOffset)) < 1e-6,
    "[calibration] translation round-trip: camera did not follow the subject"
  );
  console.assert(r1.target.distanceTo(translated.position) < 1e-6, "[calibration] translation round-trip: target drifted");

  // Uniform scale case (2x) — distance from subject should double with the bounding radius.
  const scaled = makeSubject();
  const t2 = captureShotTemplate(camera, target, [scaled], ["synthetic"]);
  scaled.scale.setScalar(2);
  scaled.updateWorldMatrix(true, true);
  const r2 = regenerateFromTemplate(t2, [scaled]);
  console.assert(
    Math.abs(r2.position.distanceTo(scaled.position) - originalDistance * 2) < 1e-6,
    "[calibration] scale round-trip: camera did not pull back with the subject's growth"
  );

  console.assert(r1.fov === t1.fov && r2.fov === t2.fov, "[calibration] fov should pass through the template unchanged");
}
