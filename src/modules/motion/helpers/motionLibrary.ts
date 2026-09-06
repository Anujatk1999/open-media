/**
 * Saves one object's reusable keyframe sequence (not the whole scene), so it
 * can be applied to another compatible character/camera later. Mirrors
 * sceneLibrary.ts's localStorage-array + slugify pattern — the only precedent
 * for "save a reusable thing" in this codebase.
 *
 * ponytail: persistence is localStorage, per browser/device — same ceiling as
 * sceneLibrary.ts and poseLibrary.ts. Add a real backend when motions need to
 * be shared between machines.
 */
import type { Keyframe, MotionObject, MotionObjectType } from "../../../stores/composerStore";

export interface MotionAsset {
  id: string;
  name: string;
  category: string;
  description: string;
  savedAt: string;
  duration: number;
  objectType: MotionObjectType;
  keyframes: Keyframe[];
}

const KEY = "motion.motionLibrary.v1";

const MANNEQUIN_TYPES = new Set<MotionObjectType>(["male", "female", "child"]);

/** Mannequins share one posture format regardless of body type; every other type (camera, primitives) only applies to its own exact type. */
export function isMotionCompatible(entryType: MotionObjectType, targetType: MotionObjectType): boolean {
  if (MANNEQUIN_TYPES.has(entryType)) return MANNEQUIN_TYPES.has(targetType);
  return entryType === targetType;
}

function slugify(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export function loadMotionLibrary(): MotionAsset[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

function writeMotionLibrary(entries: MotionAsset[]): void {
  localStorage.setItem(KEY, JSON.stringify(entries));
}

/** Appends a new entry, disambiguating its id from any existing motion of the same name. */
export function saveMotionToLibrary(
  name: string,
  category: string,
  description: string,
  object: MotionObject,
  duration: number,
): MotionAsset {
  const entries = loadMotionLibrary();
  const slug = slugify(name) || "motion";
  let id = slug;
  for (let n = 2; entries.some((e) => e.id === id); n++) id = `${slug}-${n}`;

  const entry: MotionAsset = {
    id,
    name: name.trim() || "Untitled Motion",
    category: category.trim(),
    description: description.trim(),
    savedAt: new Date().toISOString(),
    duration,
    objectType: object.type,
    keyframes: structuredClone(object.keyframes),
  };
  writeMotionLibrary([...entries, entry]);
  return entry;
}
