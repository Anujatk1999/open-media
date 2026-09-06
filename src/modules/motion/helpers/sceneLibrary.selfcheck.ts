import { saveSceneToLibrary, loadSceneLibrary } from "./sceneLibrary.ts";

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(`sceneLibrary self-check failed: ${msg}`);
}

// Minimal localStorage stub — this runs outside a browser.
const store = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
};

const objects: any[] = [{ id: "a", transform: { position: [0, 0, 0] } }];
const shotParams: any = { shotSize: "full", angle: "front", elevation: "eye", composition: {} };

const first = saveSceneToLibrary("Rooftop Chase", objects, 4, shotParams);
assert(first.id === "rooftop-chase", `expected slug id, got ${first.id}`);

// Saving the same name again must not collide with the first entry's id.
const second = saveSceneToLibrary("Rooftop Chase", objects, 4, shotParams);
assert(second.id === "rooftop-chase-2", `expected disambiguated id, got ${second.id}`);

// Saved entry must not alias the caller's live objects array.
objects[0].transform.position[0] = 99;
assert(first.objects[0].transform.position[0] === 0, "saved entry aliased caller's objects");

const all = loadSceneLibrary();
assert(all.length === 2, `expected 2 saved scenes, got ${all.length}`);

console.log("sceneLibrary self-check: all assertions passed");
