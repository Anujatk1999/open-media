/**
 * Wraps scenes already saved via "Save to Library" (composerStore + sceneLibrary.ts,
 * unchanged) as one LibraryEntry source. Categories are derived from what the
 * saved objects actually contain — never invented — so an entry only claims
 * "Poses" or "Camera Movement" when the data backs it up.
 */
import { loadSceneLibrary, type SceneLibraryEntry } from "../../motion/helpers/sceneLibrary";
import type { LibraryCategory, MotionSceneLibraryEntry } from "./libraryEntry";

const CHARACTER_TYPES = new Set(["male", "female", "child"]);

function deriveCategories(entry: SceneLibraryEntry): LibraryCategory[] {
  const categories: LibraryCategory[] = ["sceneType"];

  if (entry.objects.some((o) => CHARACTER_TYPES.has(o.type))) categories.push("characters");
  if (entry.objects.some((o) => o.posture || o.keyframes.some((k) => k.posture))) categories.push("poses");
  if (entry.objects.some((o) => o.type === "camera" && o.keyframes.length > 1)) categories.push("cameraMovement");

  return categories;
}

function motionSceneToLibraryEntry(entry: SceneLibraryEntry): MotionSceneLibraryEntry {
  return {
    id: `motion-scene:${entry.id}`,
    title: entry.name,
    categories: deriveCategories(entry),
    source: "motion-scene",
    data: entry,
  };
}

export function getMotionSceneLibraryEntries(): MotionSceneLibraryEntry[] {
  return loadSceneLibrary().map(motionSceneToLibraryEntry);
}
