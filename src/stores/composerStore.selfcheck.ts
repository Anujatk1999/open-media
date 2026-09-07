import { useComposerStore, resolveRenderCamera } from "./composerStore.ts";
import type { SceneObject } from "./composerStore.ts";

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(`composerStore self-check failed: ${msg}`);
}

// --- resolveRenderCamera: pure priority logic (active, else first, no sequence special-case) ---
const camA: SceneObject = { id: "camA", name: "A", type: "camera", visible: true, locked: false, transform: { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] }, keyframes: [], liveEditTime: null };
const camB: SceneObject = { ...camA, id: "camB", name: "B" };

assert(resolveRenderCamera([], null) === null, "no cameras at all should resolve to nothing");
assert(resolveRenderCamera([camA, camB], null)!.id === "camA", "no active camera should fall back to the first camera");
assert(resolveRenderCamera([camA, camB], "camB")!.id === "camB", "an explicitly active camera wins");
assert(resolveRenderCamera([camA, camB], "does-not-exist")!.id === "camA", "a stale/invalid active id falls back the same as no active id");

// --- store integration: addShotSegment never creates any camera object, and duration grows to fit ---
const store = useComposerStore.getState();
store.clearScene();
store.addObject("male");
const charId = useComposerStore.getState().objects[0].id;

const shotParams = { shotSize: "wide" as const, angle: "front" as const, elevation: "eye" as const, composition: { id: "center", label: "Center", screenX: 0.5, screenY: 0.5 } };

store.addShotSegment({ targetId: charId, shotParams });
const afterFirst = useComposerStore.getState();
assert(afterFirst.objects.filter((o) => o.type === "camera").length === 0, "adding a shot segment must never create a camera object");
assert(afterFirst.shotSequence.length === 1, "the segment should land in the top-level shotSequence array");

store.addShotSegment({ targetId: charId, shotParams: { ...shotParams, shotSize: "closeup" } });
const afterSecond = useComposerStore.getState();
assert(afterSecond.objects.filter((o) => o.type === "camera").length === 0, "adding a second shot segment must still not create a camera object");
assert(afterSecond.shotSequence.length === 2, "both segments should land in shotSequence");
assert(afterSecond.playback.duration >= 6, "the timeline duration should grow to cover the full 2-segment (3s+3s) sequence, not truncate it");

// --- reorder / update / remove ---
const [firstId, secondId] = afterSecond.shotSequence.map((s) => s.id);
store.reorderShotSegments([secondId, firstId]);
assert(useComposerStore.getState().shotSequence[0].id === secondId, "reorder should swap segment order");

store.updateShotSegment(firstId, { duration: 5 });
assert(useComposerStore.getState().shotSequence.find((s) => s.id === firstId)!.duration === 5, "update should patch the segment's duration");

store.removeShotSegment(firstId);
const afterRemove = useComposerStore.getState();
assert(afterRemove.shotSequence.length === 1 && afterRemove.shotSequence[0].id === secondId, "remove should drop only the targeted segment");
assert(afterRemove.objects.filter((o) => o.type === "camera").length === 0, "removing a segment must never touch camera objects either");

// --- deleting the segment's target character scrubs it out of the sequence ---
store.removeShotSegment(secondId);
store.addShotSegment({ targetId: charId, shotParams });
store.deleteObject(charId);
assert(useComposerStore.getState().shotSequence.length === 0, "deleting a segment's target character should scrub that segment from shotSequence");

// --- addKeyframe (the timeline double-click path) must capture the object's
// live-staged transform at the given time, not some stale base transform ---
store.clearScene();
store.addObject("cube");
const cubeId = useComposerStore.getState().objects[0].id;

store.setElapsed(0);
store.updateObjectTransform(cubeId, { position: [0, 0, 0] });
store.addKeyframe(cubeId, 0);

store.setElapsed(3);
store.updateObjectTransform(cubeId, { position: [10, 0, 0] }); // live edit at t=3, no keyframe yet
// A real timeline double-click passes a pixel-derived time that almost never
// exactly equals the playhead (pixel rounding is way coarser than stageBase's
// 1e-6 liveness tolerance) — use a mismatched time here to catch a liveness
// check that keys off `time` instead of the actual playback.elapsed.
store.addKeyframe(cubeId, 3.002);

const cubeKeyframes = useComposerStore.getState().objects.find((o) => o.id === cubeId)!.keyframes;
assert(cubeKeyframes.length === 2, "two keyframes should have been recorded");
assert(cubeKeyframes[1].transform.position[0] === 10, "addKeyframe must capture the live-staged transform at the playhead, not the stale base transform, even when the double-click's target time doesn't exactly match elapsed");

console.log("composerStore self-check: all assertions passed");
