import { isMotionCompatible, loadMotionLibrary, saveMotionToLibrary } from "./motionLibrary.ts";

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(`motionLibrary self-check failed: ${msg}`);
}

// Minimal localStorage stub — this runs outside a browser.
const store = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
};

const object: any = {
  type: "male",
  keyframes: [{ id: "a", time: 0, transform: { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] } }],
};

const first = saveMotionToLibrary("Walk Cycle", "Locomotion", "", object, 2);
assert(first.id === "walk-cycle", `expected slug id, got ${first.id}`);

const second = saveMotionToLibrary("Walk Cycle", "", "", object, 2);
assert(second.id === "walk-cycle-2", `expected disambiguated id, got ${second.id}`);

// Saved entry must not alias the caller's live keyframes array.
object.keyframes[0].transform.position[0] = 99;
assert(first.keyframes[0].transform.position[0] === 0, "saved entry aliased caller's keyframes");

assert(loadMotionLibrary().length === 2, `expected 2 saved motions, got ${loadMotionLibrary().length}`);

assert(isMotionCompatible("male", "female"), "male motion should apply to female");
assert(isMotionCompatible("female", "child"), "female motion should apply to child");
assert(!isMotionCompatible("camera", "male"), "camera motion must not apply to a mannequin");
assert(isMotionCompatible("camera", "camera"), "camera motion should apply to another camera");

console.log("motionLibrary self-check: all assertions passed");
