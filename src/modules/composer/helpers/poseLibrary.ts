/**
 * Pose library — one flat list over what were two separate stores in the
 * prototype: the 25 authored poses (`poses/authoredPoses.json`, a flat array)
 * and the 9 registry poses (`poses/registry.json` + one file each). They already
 * shared the posture v7 format and differed only in wrapper, so they are merged
 * on load rather than kept apart.
 *
 * Anything that is not a valid v7 posture is dropped with a console warning
 * instead of throwing — one bad file must not empty the library.
 */

import { clonePosture, describePostureError, type Posture } from "./posture";

export type PoseSource = "authored" | "registry" | "custom";

export interface PoseEntry {
  id: string;
  name: string;
  category: string;
  source: PoseSource;
  posture: Posture;
}

const CUSTOM_KEY = "composer.customPoses.v1";

/** Cache-busted so a re-authored pose file is picked up without a hard reload. */
const bust = () => `?t=${Date.now()}`;

async function fetchJSON(path: string): Promise<unknown | null> {
  try {
    const res = await fetch(path + bust());
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/** Keeps only entries carrying a valid v7 posture, naming what it dropped. */
function accept(raw: any, source: PoseSource, fallbackCategory: string): PoseEntry | null {
  const error = describePostureError(raw?.posture);
  if (error) {
    console.warn(`[poseLibrary] skipped "${raw?.id ?? "unnamed"}": ${error}`);
    return null;
  }
  return {
    id: String(raw.id),
    name: String(raw.name ?? raw.id),
    category: String(raw.category ?? fallbackCategory),
    source,
    posture: clonePosture(raw.posture),
  };
}

async function loadAuthored(): Promise<PoseEntry[]> {
  const data = await fetchJSON("/poses/authoredPoses.json");
  if (!Array.isArray(data)) return [];
  return data
    .map((raw) => accept(raw, "authored", "authored"))
    .filter((p): p is PoseEntry => p !== null);
}

async function loadRegistry(): Promise<PoseEntry[]> {
  const registry = (await fetchJSON("/poses/registry.json")) as any;
  const entries = registry?.poses ? Object.values<any>(registry.poses) : [];
  const files = await Promise.all(
    entries.map(async (entry) => {
      const raw = await fetchJSON(`/poses/${entry.file}`);
      return raw ? accept(raw, "registry", entry.category ?? "registry") : null;
    }),
  );
  return files.filter((p): p is PoseEntry => p !== null);
}

export function loadCustomPoses(): PoseEntry[] {
  try {
    const raw = JSON.parse(localStorage.getItem(CUSTOM_KEY) ?? "[]");
    if (!Array.isArray(raw)) return [];
    return raw
      .map((entry) => accept(entry, "custom", "custom"))
      .filter((p): p is PoseEntry => p !== null);
  } catch {
    return [];
  }
}

function writeCustomPoses(poses: PoseEntry[]): void {
  localStorage.setItem(CUSTOM_KEY, JSON.stringify(poses));
}

/**
 * The library, one row per id. This is the single source of truth the panel
 * re-reads after every save — nothing is spliced into the displayed list by hand.
 *
 * The JSON under /poses is served read-only, so an edited bundled pose is stored
 * in localStorage under the id it already has. On load it replaces the bundled
 * record in place and keeps that record's identity — same id, same source — so
 * it stays one entry and is never mistaken for a pose the user created. Whatever
 * ids are left in localStorage afterwards are exactly the user's own poses.
 */
export async function loadPoseLibrary(): Promise<PoseEntry[]> {
  const [authored, registry] = await Promise.all([loadAuthored(), loadRegistry()]);
  const edits = new Map(loadCustomPoses().map((pose) => [pose.id, pose]));

  const bundled = [...authored, ...registry].map((pose) => {
    const edit = edits.get(pose.id);
    if (!edit) return pose;
    edits.delete(pose.id);
    return { ...edit, source: pose.source, category: pose.category };
  });

  return [...bundled, ...edits.values()];
}

const slugify = (name: string) =>
  name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "pose";

/**
 * Saves under `custom.<slug>`, appending -2/-3 on collision so a save can never
 * overwrite an existing pose. Overwriting is Update's job alone.
 */
export function saveCustomPose(name: string, posture: Posture): PoseEntry {
  const existing = loadCustomPoses();
  const taken = new Set(existing.map((p) => p.id));
  const base = `custom.${slugify(name)}`;
  let id = base;
  for (let n = 2; taken.has(id); n++) id = `${base}-${n}`;

  const entry: PoseEntry = {
    id,
    name: name.trim() || id,
    category: "custom",
    source: "custom",
    posture: clonePosture(posture),
  };
  writeCustomPoses([...existing, entry]);
  return entry;
}

/**
 * Overwrites the one record stored under `id` — never appends a second. The
 * first edit of a bundled pose creates that record; every later Update replaces
 * it, so a pose can be loaded, reposed and updated any number of times and stay
 * a single entry.
 *
 * ponytail: persistence is localStorage, per browser. The prototype POSTed the
 * whole library to its own `serve.js`; this app has no write endpoint, so add
 * one (plus an export) if poses ever need to be shared between machines.
 */
export function updatePose(id: string, name: string, posture: Posture): PoseEntry {
  const existing = loadCustomPoses();
  const index = existing.findIndex((p) => p.id === id);
  const entry: PoseEntry = {
    id,
    name: name.trim() || existing[index]?.name || id,
    category: existing[index]?.category ?? "custom",
    source: "custom",
    posture: clonePosture(posture),
  };
  if (index === -1) existing.push(entry);
  else existing[index] = entry;
  writeCustomPoses(existing);
  return entry;
}

export function deleteCustomPose(id: string): void {
  writeCustomPoses(loadCustomPoses().filter((p) => p.id !== id));
}
