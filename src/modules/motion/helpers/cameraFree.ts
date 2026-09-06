import * as THREE from "three";

/**
 * A cinematic camera here is a free body: position + orientation + FOV, no
 * orbit target/pivot and no per-frame lookAt(). Manipulation goes through the
 * same generic TransformControls-based gizmo every other object type uses
 * (see TransformGizmo.tsx) — it writes `SceneTransform.rotation` (plain XYZ
 * Euler) directly, same field sampleTrack.ts already slerps via quaternion
 * for keyframe interpolation, so no extra field is needed on
 * Keyframe/MotionObject.
 */
export interface YawPitch {
  yaw: number;
  pitch: number;
}

/** The plain XYZ-order Euler (matching SceneTransform.rotation) for a given yaw (world Y) + pitch (local X) pair, applied yaw-then-pitch with no roll. */
export function eulerFromYawPitch(yaw: number, pitch: number): [number, number, number] {
  const quaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch, yaw, 0, "YXZ"));
  const euler = new THREE.Euler().setFromQuaternion(quaternion);
  return [euler.x, euler.y, euler.z];
}

/** A sensible default orientation for a freshly placed camera: facing `target`, no roll. */
export function yawPitchTowards(position: [number, number, number], target: [number, number, number]): YawPitch {
  const offset = new THREE.Vector3(...target).sub(new THREE.Vector3(...position));
  const distance = offset.length() || 1;
  return {
    yaw: Math.atan2(-offset.x, -offset.z),
    pitch: Math.asin(THREE.MathUtils.clamp(offset.y / distance, -1, 1)),
  };
}
