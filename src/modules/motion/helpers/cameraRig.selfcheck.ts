import * as THREE from "three";
import { evaluateCameraRig, evaluateShotSequence, type RigLookups } from "./cameraRig.ts";
import type { CameraRig, SceneObject, ShotSegment } from "../../../stores/composerStore.ts";
import type { CompositionPreset } from "../../library/calibration/shotSolver.ts";

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(`cameraRig self-check failed: ${msg}`);
}

function close(a: number, b: number, eps = 1e-6): boolean {
  return Math.abs(a - b) < eps;
}

const obj = (position: [number, number, number]): SceneObject => ({
  id: "target", name: "Target", type: "male", visible: true, locked: false,
  transform: { position, rotation: [0, 0, 0], scale: [1, 1, 1] },
  keyframes: [], liveEditTime: null,
});

/** A standing mannequin's actual bounding box, for the rig types that need a real Object3D root rather than sampled position data. */
function characterRoot(position: [number, number, number]): THREE.Object3D {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.7, 0.5));
  mesh.position.set(position[0], position[1] + 0.85, position[2]);
  mesh.updateMatrixWorld(true);
  return mesh;
}

const objects = new Map<string, SceneObject>();
const roots = new Map<string, THREE.Object3D>();
const lookups: RigLookups = {
  getObject: (id) => objects.get(id),
  getRoot: (id) => roots.get(id),
};
const cameraInfo = { fovDeg: 40, aspect: 1 };

// follow: maintains a constant offset from a moving target and always faces it.
const followRig: CameraRig = { type: "follow", targetId: "target", offset: [0, 2, -3] };
objects.set("target", obj([0, 0, 0]));
const f1 = evaluateCameraRig(followRig, 0, cameraInfo, lookups)!;
objects.set("target", obj([5, 0, 0]));
const f2 = evaluateCameraRig(followRig, 1, cameraInfo, lookups)!;
assert(f1.position!.distanceTo(new THREE.Vector3(0, 2, -3)) < 1e-6, "follow should offset from the target's position");
assert(f2.position!.clone().sub(f1.position!).distanceTo(new THREE.Vector3(5, 0, 0)) < 1e-6, "follow should track the target 1:1 as it moves");
assert(f2.lookAt.distanceTo(new THREE.Vector3(5, 0, 0)) < 1e-6, "follow should look at the target's current position");

// orbit: sweeps smoothly, holds before/after its window, and never sits at the target (so lookAt is always well-defined).
const orbitRig: CameraRig = { type: "orbit", targetId: "target", radius: 4, height: 1.5, startAngleDeg: 0, endAngleDeg: 360, duration: 10, startTime: 0 };
objects.set("target", obj([0, 0, 0]));
const before = evaluateCameraRig(orbitRig, -1, cameraInfo, lookups)!;
const start = evaluateCameraRig(orbitRig, 0, cameraInfo, lookups)!;
const quarter = evaluateCameraRig(orbitRig, 2.5, cameraInfo, lookups)!;
const end = evaluateCameraRig(orbitRig, 10, cameraInfo, lookups)!;
const after = evaluateCameraRig(orbitRig, 11, cameraInfo, lookups)!;
assert(before.position!.distanceTo(start.position!) < 1e-6, "orbit should hold at the start angle before its window");
assert(end.position!.distanceTo(after.position!) < 1e-6, "orbit should hold at the end angle after its window");
assert(start.position!.distanceTo(end.position!) < 1e-3, "a 0->360 orbit should end where it started");
assert(close(quarter.position!.x, 4, 1e-3) && close(quarter.position!.z, 0, 1e-3), "a quarter through a 0->360 orbit should sit at the +X pole of the circle");
for (const sample of [before, start, quarter, end, after]) {
  assert(close(sample.position!.y, 1.5), "orbit height should stay constant");
  assert(sample.position!.distanceTo(sample.lookAt) > 0.1, "orbit camera should never coincide with its own look-at target");
}

// Continuity: no jump discontinuity anywhere across the sweep (the actual "no flip" guarantee — position is a continuous function of elapsed).
let maxStep = 0;
let prev = evaluateCameraRig(orbitRig, 0, cameraInfo, lookups)!.position!;
for (let t = 0.05; t <= 10; t += 0.05) {
  const cur = evaluateCameraRig(orbitRig, t, cameraInfo, lookups)!.position!;
  maxStep = Math.max(maxStep, cur.distanceTo(prev));
  prev = cur;
}
assert(maxStep < 0.2, `orbit position should move smoothly, not jump (max step ${maxStep.toFixed(3)})`);

// A rig whose targetId doesn't resolve (deleted object, e.g.) evaluates to null rather than throwing.
assert(evaluateCameraRig({ type: "follow", targetId: "missing", offset: [0, 0, 0] }, 0, cameraInfo, lookups) === null, "an unresolvable target should evaluate to null, not throw");

const CENTER: CompositionPreset = { id: "center", label: "Center", screenX: 0.5, screenY: 0.5 };
const mediumFront = { shotSize: "medium" as const, angle: "front" as const, elevation: "eye" as const, composition: CENTER };

// shot: continuously re-solves a framing preset against a live bounding box.
roots.set("charA", characterRoot([0, 0, 0]));
const shotRig: CameraRig = { type: "shot", targetId: "charA", shotParams: mediumFront };
const shotResult = evaluateCameraRig(shotRig, 0, cameraInfo, lookups)!;
assert(shotResult.position !== undefined, "shot should set a position");
assert(shotResult.lookAt.distanceTo(new THREE.Vector3(0, 0, 0)) < 2, "shot should look roughly at its target's center");
assert(evaluateCameraRig({ type: "shot", targetId: "missingChar", shotParams: mediumFront }, 0, cameraInfo, lookups) === null, "shot with no resolvable root should evaluate to null");

// OTS: a shot with a secondaryTargetId should aim past the primary toward the second character, not just frame the primary.
roots.set("charB", characterRoot([0, 0, 3]));
const soloOts = evaluateCameraRig({ type: "shot", targetId: "charA", shotParams: { ...mediumFront, angle: "ots" } }, 0, cameraInfo, lookups)!;
const twoCharOts = evaluateCameraRig({ type: "shot", targetId: "charA", secondaryTargetId: "charB", shotParams: { ...mediumFront, angle: "ots" } }, 0, cameraInfo, lookups)!;
assert(twoCharOts.lookAt.distanceTo(soloOts.lookAt) > 0.5, "an ots shot with a second character should aim differently than a solo ots shot");

// shot sequence: hands framing off from one segment's target to the next's as elapsed crosses each segment boundary, with no gap/hold at the seam.
// Evaluated straight off the store's shotSequence array via evaluateShotSequence — no CameraRig involved, no camera object required.
roots.set("charFar", characterRoot([10, 0, 0]));
const segA: ShotSegment = { id: "segA", targetId: "charA", shotParams: mediumFront, duration: 2 };
const segB: ShotSegment = { id: "segB", targetId: "charFar", shotParams: mediumFront, duration: 2 };
const segments = [segA, segB];
const seqEarly = evaluateShotSequence(segments, 1, cameraInfo, lookups)!;
const seqAtBoundary = evaluateShotSequence(segments, 2, cameraInfo, lookups)!;
const seqLate = evaluateShotSequence(segments, 3, cameraInfo, lookups)!;
const seqAfterEnd = evaluateShotSequence(segments, 20, cameraInfo, lookups)!;
assert(seqEarly.lookAt.distanceTo(new THREE.Vector3(0, seqEarly.lookAt.y, 0)) < 2, "the first segment should frame its own target");
assert(seqAtBoundary.lookAt.x > 5, "exactly at a segment boundary, the sequence should already frame the next segment's target");
assert(seqLate.lookAt.x > 5, "mid-way through the second segment, it should still frame the second segment's target");
assert(seqLate.lookAt.distanceTo(seqAfterEnd.lookAt) < 1e-6, "after the sequence ends, it should hold on the last segment's framing");
assert(evaluateShotSequence([], 0, cameraInfo, lookups) === null, "an empty sequence should evaluate to null");

console.log("cameraRig self-check: all assertions passed");
