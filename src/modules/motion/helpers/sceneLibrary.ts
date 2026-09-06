/**
 * Saves a full motion scene (objects/transforms/poses/keyframes/duration +
 * the active shot composition) so it can later be surfaced as a reusable
 * community scene. No browse/marketplace UI yet — this is just the save-side
 * data flow, mirroring composer/helpers/poseLibrary.ts's localStorage-array
 * pattern (same slugify+dedupe shape) since that's the only precedent for
 * "save a reusable thing" already in this codebase.
 *
 * ponytail: persistence is localStorage, per browser/device. Add a real
 * backend + list/browse UI when scenes need to be shared between machines
 * or surfaced as an actual community library.
 */
import type { MotionObject } from "../../../stores/composerStore";
import type { ShotParams } from "../../library/calibration/shotSolver";

export interface SceneLibraryEntry {
  id: string;
  name: string;
  savedAt: string;
  duration: number;
  shotParams: ShotParams;
  objects: MotionObject[];
}

const KEY = "motion.sceneLibrary.v1";

function slugify(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export function loadSceneLibrary(): SceneLibraryEntry[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

function writeSceneLibrary(entries: SceneLibraryEntry[]): void {
  localStorage.setItem(KEY, JSON.stringify(entries));
}

/** Appends a new entry, disambiguating its id from any existing scene of the same name. */
export function saveSceneToLibrary(
  name: string,
  objects: MotionObject[],
  duration: number,
  shotParams: ShotParams,
): SceneLibraryEntry {
  const entries = loadSceneLibrary();
  const slug = slugify(name) || "scene";
  let id = slug;
  for (let n = 2; entries.some((e) => e.id === id); n++) id = `${slug}-${n}`;

  const entry: SceneLibraryEntry = {
    id,
    name: name.trim() || "Untitled Scene",
    savedAt: new Date().toISOString(),
    duration,
    shotParams: structuredClone(shotParams),
    objects: structuredClone(objects),
  };
  writeSceneLibrary([...entries, entry]);
  return entry;
}
