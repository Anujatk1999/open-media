import type { ComposerMode } from '../composer/ComposerViewport';
import type { ComposerViewportAPI } from '../composer/ComposerViewport';
import type { ShotParams } from '../library/calibration/shotSolver';

/**
 * Shot size/angle/elevation/composition and the static/motion mode toggle
 * live as local React state in ComposerShell, not in the Zustand store — so
 * the MCP bridge needs a small registry ComposerShell hands its setters to,
 * the same way it hands ComposerViewportAPI through a ref. Everything else
 * the bridge needs (objects, keyframes, playback, selection) is already
 * reachable via `useComposerStore.getState()` from anywhere.
 */
export interface ShotAPI {
  getShotParams: () => ShotParams;
  setShotParams: (next: ShotParams) => void;
  getMode: () => ComposerMode;
  setMode: (next: ComposerMode) => void;
}

let shotAPI: ShotAPI | null = null;
let viewportAPI: ComposerViewportAPI | null = null;

export function registerShotAPI(api: ShotAPI | null) {
  shotAPI = api;
}

export function registerViewportAPI(api: ComposerViewportAPI | null) {
  viewportAPI = api;
}

export function getShotAPI(): ShotAPI | null {
  return shotAPI;
}

export function getViewportAPI(): ComposerViewportAPI | null {
  return viewportAPI;
}
