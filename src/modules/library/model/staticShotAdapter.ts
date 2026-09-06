/**
 * Wraps the existing generated static shot set (unchanged —
 * see shotLibraryData.ts) as one LibraryEntry source. No new axis/category
 * (e.g. "Elevation") is invented here: only Composition/Shot Size/Camera
 * Angle are tagged, matching today's actual browsable axes on library.html.
 */
import { SHOT_LIBRARY, type ShotLibraryEntry } from "../calibration/shotLibraryData";
import type { LibraryCategory, StaticShotLibraryEntry } from "./libraryEntry";

const STATIC_SHOT_CATEGORIES: LibraryCategory[] = ["composition", "shotSize", "cameraAngle"];

function staticShotToLibraryEntry(entry: ShotLibraryEntry): StaticShotLibraryEntry {
  return {
    id: `static-shot:${entry.id}`,
    title: entry.label,
    categories: STATIC_SHOT_CATEGORIES,
    source: "static-shot",
    data: entry,
  };
}

export function getStaticShotLibraryEntries(): StaticShotLibraryEntry[] {
  return SHOT_LIBRARY.map(staticShotToLibraryEntry);
}
