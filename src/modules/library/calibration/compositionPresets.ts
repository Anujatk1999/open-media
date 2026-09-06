/**
 * Composition preset registry — kept separate from shotSolver.ts on purpose:
 * the solver only ever consumes {screenX, screenY}, so adding a new preset
 * (or a whole new preset *kind*, like golden ratio or OTS) is just adding an
 * entry here, never touching the solver.
 */
import type { CompositionPreset } from "./shotSolver";

export const COMPOSITION_PRESETS: CompositionPreset[] = [
  { id: "center", label: "Center", screenX: 0.5, screenY: 0.5 },
  { id: "leftThird", label: "Left Third", screenX: 1 / 3, screenY: 0.5 },
  { id: "rightThird", label: "Right Third", screenX: 2 / 3, screenY: 0.5 },
  { id: "upperThird", label: "Upper Third", screenX: 0.5, screenY: 2 / 3 },
  { id: "lowerThird", label: "Lower Third", screenX: 0.5, screenY: 1 / 3 },
  // ponytail: no canonical "negative space" ratio exists — placing the
  // subject further off-axis than a rule-of-thirds line (~0.22 vs ~0.33) so
  // the opposite half of frame stays clear for overlay/text is a first
  // guess. Revisit once there's a real overlay/text use case to check it against.
  { id: "negativeSpace", label: "Negative Space", screenX: 0.22, screenY: 0.5 },
];

export const DEFAULT_COMPOSITION_PRESET = COMPOSITION_PRESETS[0];

export function getCompositionPreset(id: string): CompositionPreset {
  return COMPOSITION_PRESETS.find((preset) => preset.id === id) ?? DEFAULT_COMPOSITION_PRESET;
}
