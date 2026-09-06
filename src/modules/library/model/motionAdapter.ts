/**
 * Wraps motions saved via "Save Motion" (motion/helpers/motionLibrary.ts,
 * unchanged) as one LibraryEntry source. A camera's saved track is tagged
 * "cameraMovement" rather than "actions" — this is how camera movement
 * surfaces inside the Motion Library instead of as its own top-level nav item.
 */
import { loadMotionLibrary, type MotionAsset } from "../../motion/helpers/motionLibrary";
import type { LibraryCategory, MotionLibraryEntry } from "./libraryEntry";

function motionAssetToLibraryEntry(entry: MotionAsset): MotionLibraryEntry {
  const categories: LibraryCategory[] = entry.objectType === "camera" ? ["cameraMovement"] : ["actions"];
  return {
    id: `motion:${entry.id}`,
    title: entry.name,
    categories,
    source: "motion",
    data: entry,
  };
}

export function getMotionLibraryEntries(): MotionLibraryEntry[] {
  return loadMotionLibrary().map(motionAssetToLibraryEntry);
}
