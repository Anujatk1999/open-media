/**
 * Single entry point for the unified library data layer. Not imported by
 * library.html/ShotLibraryPage yet — this is the future integration point
 * once the library UI is redesigned to browse all three sources together.
 */
export * from "./libraryEntry";
export { getStaticShotLibraryEntries } from "./staticShotAdapter";
export { getMotionSceneLibraryEntries } from "./motionSceneAdapter";
export { communityScenesToLibraryEntries } from "./communitySceneAdapter";
export { getPoseLibraryEntries } from "./poseAdapter";
export { getMotionLibraryEntries } from "./motionAdapter";

import type { CommunitySceneData, LibraryEntry } from "./libraryEntry";
import { getStaticShotLibraryEntries } from "./staticShotAdapter";
import { getMotionSceneLibraryEntries } from "./motionSceneAdapter";
import { communityScenesToLibraryEntries } from "./communitySceneAdapter";
import { getMotionLibraryEntries } from "./motionAdapter";

/**
 * Combines every sync source into one flat, browsable list. `communityEntries`
 * defaults to none until a backend exists. Poses are excluded here — see
 * poseAdapter.ts's getPoseLibraryEntries(), which is async (it fetches bundled
 * JSON) and so is loaded separately by the page and merged in after.
 */
export function getAllLibraryEntries(communityEntries: CommunitySceneData[] = []): LibraryEntry[] {
  return [
    ...getStaticShotLibraryEntries(),
    ...getMotionSceneLibraryEntries(),
    ...getMotionLibraryEntries(),
    ...communityScenesToLibraryEntries(communityEntries),
  ];
}
