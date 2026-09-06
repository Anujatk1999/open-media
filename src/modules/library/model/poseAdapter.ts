/**
 * Wraps the existing Pose Library (composer/helpers/poseLibrary.ts, unchanged
 * — authored + registry + custom poses saved from either composer's viewport)
 * as one LibraryEntry source.
 */
import { loadPoseLibrary, type PoseEntry } from "../../composer/helpers/poseLibrary";
import type { PoseLibraryEntry } from "./libraryEntry";

function poseEntryToLibraryEntry(entry: PoseEntry): PoseLibraryEntry {
  return {
    id: `pose:${entry.id}`,
    title: entry.name,
    categories: ["poses"],
    source: "pose",
    data: entry,
  };
}

/** Async because poseLibrary.ts fetches the bundled authored/registry JSON — unlike the other adapters, this cannot be included in getAllLibraryEntries()'s sync return. */
export async function getPoseLibraryEntries(): Promise<PoseLibraryEntry[]> {
  return (await loadPoseLibrary()).map(poseEntryToLibraryEntry);
}
