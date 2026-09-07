/**
 * Pure per-frame evaluation of a procedural camera rig (see CameraRig in
 * composerStore.ts). Kept separate from ComposerViewport's useFrame so the
 * math itself — quaternion/vector only, no hand-authored Euler rotation
 * keyframes — is unit-testable headlessly and has one obvious home instead of
 * living inline in a render loop.
 *
 * A target's position is always read via `stageBase` (pure data sampled from
 * its own keyframe track/live edit), never a live Object3D, so a rig never
 * depends on useFrame ordering between objects. "shot" is the one exception:
 * framing needs a real bounding box, so it takes the target's live Object3D
 * root(s) directly, resolved on demand via `lookups`.
 *
 * `evaluateShotSequence` below evaluates the store's top-level shot sequence
 * the same way a "shot" rig evaluates one framing — its active segment can
 * name a different targetId every frame, so lookups resolve on demand rather
 * than the caller pre-resolving a single target/root before calling in.
 */
import * as THREE from "three";
import { stageBase, type CameraRig, type SceneObject, type ShotSegment } from "../../../stores/composerStore";
import { getCharacterAnchors, solveShot, type ShotParams } from "../../library/calibration/shotSolver";
import { activeShotSegment } from "./shotSequence";

export interface RigResult {
  position: THREE.Vector3;
  lookAt: THREE.Vector3;
}

/** Camera-side inputs a "shot" rig (or the shot sequence) needs that only exist on the live three.js camera, not the SceneObject data. */
export interface RigCameraInfo {
  fovDeg: number;
  aspect: number;
}

/** On-demand resolution of a rig's target(s), since the shot sequence's active segment can name a different target every frame. */
export interface RigLookups {
  getObject: (id: string) => SceneObject | undefined;
  getRoot: (id: string) => THREE.Object3D | undefined;
}

function solveShotFraming(
  shotParams: ShotParams,
  targetId: string,
  secondaryTargetId: string | null | undefined,
  cameraInfo: RigCameraInfo,
  lookups: RigLookups,
): RigResult | null {
  const targetRoot = lookups.getRoot(targetId);
  if (!targetRoot) return null;
  const secondaryRoot = secondaryTargetId ? lookups.getRoot(secondaryTargetId) : undefined;
  const anchors = getCharacterAnchors(targetRoot);
  const targetAnchors = secondaryRoot ? getCharacterAnchors(secondaryRoot) : undefined;
  const solved = solveShot({ ...shotParams, anchors, targetAnchors, fovDeg: cameraInfo.fovDeg, aspect: cameraInfo.aspect });
  return { position: solved.position, lookAt: solved.target };
}

export function evaluateCameraRig(
  rig: CameraRig,
  elapsed: number,
  cameraInfo: RigCameraInfo,
  lookups: RigLookups,
): RigResult | null {
  switch (rig.type) {
    case "follow": {
      const target = lookups.getObject(rig.targetId);
      if (!target) return null;
      const [x, y, z] = stageBase(target, elapsed).transform.position;
      const [ox, oy, oz] = rig.offset;
      return { position: new THREE.Vector3(x + ox, y + oy, z + oz), lookAt: new THREE.Vector3(x, y, z) };
    }
    case "orbit": {
      const target = lookups.getObject(rig.targetId);
      if (!target) return null;
      const [x, y, z] = stageBase(target, elapsed).transform.position;
      const span = rig.duration > 0 ? THREE.MathUtils.clamp((elapsed - rig.startTime) / rig.duration, 0, 1) : 1;
      const angleRad = THREE.MathUtils.degToRad(THREE.MathUtils.lerp(rig.startAngleDeg, rig.endAngleDeg, span));
      const position = new THREE.Vector3(x + Math.sin(angleRad) * rig.radius, y + rig.height, z + Math.cos(angleRad) * rig.radius);
      return { position, lookAt: new THREE.Vector3(x, y, z) };
    }
    case "shot": {
      return solveShotFraming(rig.shotParams, rig.targetId, rig.secondaryTargetId, cameraInfo, lookups);
    }
  }
}

/** Evaluates the store's top-level shot sequence at `elapsed`, the same way a "shot" rig evaluates its one framing — for the dedicated runtime cinematic camera, never a scene camera object. */
export function evaluateShotSequence(
  segments: ShotSegment[],
  elapsed: number,
  cameraInfo: RigCameraInfo,
  lookups: RigLookups,
): RigResult | null {
  const segment: ShotSegment | null = activeShotSegment(segments, elapsed);
  if (!segment) return null;
  return solveShotFraming(segment.shotParams, segment.targetId, segment.secondaryTargetId, cameraInfo, lookups);
}
