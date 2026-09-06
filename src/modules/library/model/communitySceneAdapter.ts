/**
 * Converts already-fetched community scene JSON (CommunitySceneData — see
 * libraryEntry.ts) into LibraryEntry form. No network/backend call lives
 * here: callers supply the data (e.g. a hand-authored fixture today, a real
 * fetch response later) until a backend exists.
 */
import type { CommunitySceneData, CommunitySceneLibraryEntry } from "./libraryEntry";

function communitySceneToLibraryEntry(entry: CommunitySceneData): CommunitySceneLibraryEntry {
  return {
    id: `community-scene:${entry.id}`,
    title: entry.name,
    categories: ["community"],
    source: "community-scene",
    data: entry,
  };
}

export function communityScenesToLibraryEntries(entries: CommunitySceneData[]): CommunitySceneLibraryEntry[] {
  return entries.map(communitySceneToLibraryEntry);
}
