import * as THREE from "three";
import type { Posture } from "../../composer/helpers/posture";

export interface KeyframeLike {
  time: number;
  transform: {
    position: [number, number, number];
    rotation: [number, number, number];
    scale: [number, number, number];
  };
  posture?: Posture;
  /** Camera field of view in degrees. Only meaningful for camera objects. */
  fov?: number;
}

export interface SampledTrack {
  transform: KeyframeLike["transform"];
  posture?: Posture;
  fov?: number;
}

// Kicked off once at module load, not lazily inside sampleTrack: sampleTrack
// runs synchronously every frame (from useFrame), so it cannot await anything.
// This module is also imported by a plain-Node self-check (see
// sampleTrack.selfcheck.ts), and mannequin-js/src/mannequin.js statically
// re-exports mannequin-js/src/scene.js, which touches `document`/`window`
// unconditionally at load and crashes outside a browser — hence the
// dynamic import wrapped in a rejection handler instead of a static one.
let blendFn: ((a: Posture, b: Posture, k: number) => Posture) | null = null;
import("mannequin-js/src/mannequin.js")
  .then((mod) => { blendFn = (mod as any).blend ?? null; })
  .catch(() => { blendFn = null; });

function lerp(a: number, b: number, k: number): number {
  return a + (b - a) * k;
}

function lerpVec3(a: [number, number, number], b: [number, number, number], k: number): [number, number, number] {
  return [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];
}

function slerpRotation(a: [number, number, number], b: [number, number, number], k: number): [number, number, number] {
  const qa = new THREE.Quaternion().setFromEuler(new THREE.Euler(...a));
  const qb = new THREE.Quaternion().setFromEuler(new THREE.Euler(...b));
  const q = qa.clone().slerp(qb, k);
  const e = new THREE.Euler().setFromQuaternion(q);
  return [e.x, e.y, e.z];
}

function lerpExtra(
  a: Posture["extra"],
  b: Posture["extra"],
  k: number,
): Posture["extra"] | undefined {
  if (!a && !b) return undefined;
  const source = a ?? b!;
  const other = b ?? a!;
  const result: NonNullable<Posture["extra"]> = {};
  for (const key of Object.keys(source)) {
    const sv = source[key];
    const ov = other[key] ?? sv;
    result[key] = [lerp(sv[0], ov[0], k), lerp(sv[1], ov[1], k), lerp(sv[2], ov[2], k)];
  }
  return result;
}

/**
 * Samples a track of keyframes at `time`. AnimatedObject only calls this once
 * an object has at least one keyframe (see composerStore.ts), so this never
 * receives an empty array from a real caller — an empty array is treated as
 * a caller bug and throws.
 */
export function sampleTrack(keyframes: KeyframeLike[], time: number): SampledTrack {
  if (keyframes.length === 0) throw new Error("sampleTrack: no keyframes");

  const sorted = keyframes.length > 1 ? [...keyframes].sort((a, b) => a.time - b.time) : keyframes;
  if (sorted.length === 1 || time <= sorted[0].time) {
    return { transform: sorted[0].transform, posture: sorted[0].posture, fov: sorted[0].fov };
  }
  const last = sorted[sorted.length - 1];
  if (time >= last.time) return { transform: last.transform, posture: last.posture, fov: last.fov };

  let a = sorted[0];
  let b = last;
  for (let i = 0; i < sorted.length - 1; i++) {
    if (time >= sorted[i].time && time <= sorted[i + 1].time) {
      a = sorted[i];
      b = sorted[i + 1];
      break;
    }
  }

  const span = b.time - a.time;
  const k = span > 0 ? 0.5 - 0.5 * Math.cos(Math.PI * ((time - a.time) / span)) : 0;

  const transform: KeyframeLike["transform"] = {
    position: lerpVec3(a.transform.position, b.transform.position, k),
    rotation: slerpRotation(a.transform.rotation, b.transform.rotation, k),
    scale: lerpVec3(a.transform.scale, b.transform.scale, k),
  };

  const fov = a.fov === undefined && b.fov === undefined
    ? undefined
    : lerp(a.fov ?? b.fov!, b.fov ?? a.fov!, k);

  if (!a.posture && !b.posture) return { transform, fov };
  if (!a.posture) return { transform, posture: b.posture, fov };
  if (!b.posture) return { transform, posture: a.posture, fov };

  const posture: Posture = blendFn
    ? { ...blendFn(a.posture, b.posture, k), extra: lerpExtra(a.posture.extra, b.posture.extra, k) }
    : (k < 0.5 ? a.posture : b.posture);

  return { transform, posture, fov };
}
