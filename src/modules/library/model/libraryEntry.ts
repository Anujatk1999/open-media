/**
 * The unified shape every browsable "thing" in the Library normalizes to,
 * regardless of where it actually comes from: the generated static shot set,
 * a scene saved from the motion editor, or — later — a scene downloaded from
 * the community. One flat `LibraryEntry[]` is enough to drive a single
 * card/filter UI later; each source keeps its own native shape in `data` so
 * no information is lost or force-fit, and gets converted by its own adapter
 * (see staticShotAdapter.ts / motionSceneAdapter.ts / communitySceneAdapter.ts).
 *
 * This file is data-model only — nothing here is wired into library.html yet.
 */
import type { ShotLibraryEntry } from "../calibration/shotLibraryData";
import type { SceneLibraryEntry } from "../../motion/helpers/sceneLibrary";
import type { PoseEntry } from "../../composer/helpers/poseLibrary";
import type { MotionAsset } from "../../motion/helpers/motionLibrary";

export type LibraryCategory =
  | "composition"
  | "shotSize"
  | "cameraAngle"
  | "cameraMovement"
  | "characters"
  | "poses"
  | "actions"
  | "sceneType"
  | "community";

/** Display order/labels for the taxonomy — the only place a new category needs to be registered. */
export const LIBRARY_CATEGORIES: { id: LibraryCategory; label: string }[] = [
  { id: "composition", label: "Composition" },
  { id: "shotSize", label: "Shot Size" },
  { id: "cameraAngle", label: "Camera Angle" },
  { id: "cameraMovement", label: "Camera Movement" },
  { id: "characters", label: "Multiple Characters" },
  { id: "poses", label: "Poses" },
  { id: "actions", label: "Actions" },
  { id: "sceneType", label: "Scene Type" },
  { id: "community", label: "Community" },
];

export type LibrarySource = "static-shot" | "motion-scene" | "community-scene" | "pose" | "motion";

/**
 * A community scene is, structurally, a saved motion scene (characters,
 * primitives, poses, cameras, FOV, keyframes, duration, shot settings) plus
 * attribution — someone else's `SceneLibraryEntry` shared out of their
 * browser. No fetch/upload/backend exists yet (see sceneLibrary.ts's ponytail
 * note); this type just fixes the JSON shape a future importer/backend must
 * produce.
 */
export interface CommunitySceneData extends SceneLibraryEntry {
  author: string;
  sourceUrl?: string;
}

interface LibraryEntryBase {
  id: string;
  title: string;
  categories: LibraryCategory[];
}

export interface StaticShotLibraryEntry extends LibraryEntryBase {
  source: "static-shot";
  data: ShotLibraryEntry;
}

export interface MotionSceneLibraryEntry extends LibraryEntryBase {
  source: "motion-scene";
  data: SceneLibraryEntry;
}

export interface CommunitySceneLibraryEntry extends LibraryEntryBase {
  source: "community-scene";
  data: CommunitySceneData;
}

/** A reusable single-frame pose (composer/helpers/poseLibrary.ts, unchanged) — never a motion or a whole scene. */
export interface PoseLibraryEntry extends LibraryEntryBase {
  source: "pose";
  data: PoseEntry;
}

/** A reusable keyframe sequence for one character or camera (motion/helpers/motionLibrary.ts) — the selected object's track only, not the scene it was authored in. */
export interface MotionLibraryEntry extends LibraryEntryBase {
  source: "motion";
  data: MotionAsset;
}

export type LibraryEntry =
  | StaticShotLibraryEntry
  | MotionSceneLibraryEntry
  | CommunitySceneLibraryEntry
  | PoseLibraryEntry
  | MotionLibraryEntry;
