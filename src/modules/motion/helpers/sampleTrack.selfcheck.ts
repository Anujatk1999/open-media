import { sampleTrack, type KeyframeLike } from "./sampleTrack.ts";

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(`sampleTrack self-check failed: ${msg}`);
}

function close(a: number, b: number, eps = 1e-6): boolean {
  return Math.abs(a - b) < eps;
}

const identity = { position: [0, 0, 0] as [number, number, number], rotation: [0, 0, 0] as [number, number, number], scale: [1, 1, 1] as [number, number, number] };

// 1 keyframe: always holds it, regardless of time.
const single: KeyframeLike[] = [{ time: 0, transform: identity }];
assert(sampleTrack(single, 5).transform.position[0] === 0, "single keyframe should hold");

// 2 keyframes: before/after clamp to the endpoints.
const a: KeyframeLike = { time: 0, transform: { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] } };
const b: KeyframeLike = { time: 2, transform: { position: [10, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] } };
const track = [a, b];
assert(sampleTrack(track, -1).transform.position[0] === 0, "before first keyframe should hold the first");
assert(sampleTrack(track, 10).transform.position[0] === 10, "after last keyframe should hold the last");

// midpoint: cosine ease at k=0.5 is exactly halfway regardless of ease shape.
const mid = sampleTrack(track, 1);
assert(close(mid.transform.position[0], 5), `midpoint x should be ~5, got ${mid.transform.position[0]}`);

// unsorted input keyframes are handled the same as sorted.
const unsorted = sampleTrack([b, a], 1);
assert(close(unsorted.transform.position[0], 5), "unsorted keyframes should sort before sampling");

// no posture on either side: sampled result carries no posture.
assert(sampleTrack(track, 1).posture === undefined, "no posture in, no posture out");

// posture only on one side: holds that side, no blending against "no data".
const posture = { version: 7, data: [[0, 0, 0]] } as any;
const withPosture = [{ ...a, posture }, b];
assert(sampleTrack(withPosture, 1).posture === posture, "posture on only one side should hold, not blend");

// fov: interpolates between both sides, or holds the one side that has it.
const withFov = [{ ...a, fov: 30 }, { ...b, fov: 70 }];
assert(close(sampleTrack(withFov, 1).fov!, 50), "fov should interpolate to midpoint");
const oneSidedFov = [{ ...a, fov: 40 }, b];
assert(sampleTrack(oneSidedFov, 1).fov === 40, "fov on only one side should hold, not blend toward undefined");
assert(sampleTrack(track, 1).fov === undefined, "no fov in, no fov out");

console.log("sampleTrack self-check: all assertions passed");
