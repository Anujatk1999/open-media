import { getStaticShotLibraryEntries } from "./staticShotAdapter.ts";
import { getMotionSceneLibraryEntries } from "./motionSceneAdapter.ts";
import { communityScenesToLibraryEntries } from "./communitySceneAdapter.ts";
import { getMotionLibraryEntries } from "./motionAdapter.ts";
import { getAllLibraryEntries } from "./index.ts";
import { LIBRARY_CATEGORIES } from "./libraryEntry.ts";

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(`libraryEntry self-check failed: ${msg}`);
}

// Minimal localStorage stub — motionSceneAdapter reads through sceneLibrary.ts.
const store = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
};

assert(LIBRARY_CATEGORIES.length === 9, `expected 9 categories, got ${LIBRARY_CATEGORIES.length}`);

const staticEntries = getStaticShotLibraryEntries();
assert(staticEntries.length === 540, `expected 540 static-shot entries, got ${staticEntries.length}`);
assert(staticEntries.every((e) => e.source === "static-shot"), "static entries must carry source static-shot");
assert(new Set(staticEntries.map((e) => e.id)).size === staticEntries.length, "static entry ids must be unique");

const motionEntries = getMotionSceneLibraryEntries();
assert(motionEntries.length === 0, `expected 0 motion-scene entries against empty localStorage, got ${motionEntries.length}`);

const motionAssetEntries = getMotionLibraryEntries();
assert(motionAssetEntries.length === 0, `expected 0 motion-asset entries against empty localStorage, got ${motionAssetEntries.length}`);

const community = communityScenesToLibraryEntries([
  {
    id: "demo",
    name: "Demo",
    savedAt: new Date().toISOString(),
    duration: 4,
    shotParams: staticEntries[0].data.params,
    objects: [],
    author: "tester",
  },
]);
assert(community.length === 1 && community[0].categories.includes("community"), "community adapter must tag the community category");

const all = getAllLibraryEntries(community.map((e) => e.data));
assert(
  all.length === staticEntries.length + motionEntries.length + motionAssetEntries.length + community.length,
  "getAllLibraryEntries must combine every source",
);

console.log("libraryEntry self-check: all assertions passed");
