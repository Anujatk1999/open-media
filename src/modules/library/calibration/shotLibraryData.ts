/**
 * Generates the Stage 1 Shot Library's combinations from the existing
 * axis metadata + composition registry — no combination is hand-authored,
 * so adding a 6th shot size or a 7th composition later grows the library
 * automatically.
 */
import { ANGLE_OPTIONS, ELEVATION_OPTIONS, SHOT_SIZE_OPTIONS } from "./shotAxes";
import { COMPOSITION_PRESETS } from "./compositionPresets";
import type { CameraAngle, CompositionPreset, Elevation, ShotParams, ShotSize } from "./shotSolver";

export interface ShotLibraryEntry {
  id: string;
  label: string;
  shotSize: ShotSize;
  shotSizeLabel: string;
  angle: CameraAngle;
  angleLabel: string;
  elevation: Elevation;
  elevationLabel: string;
  composition: CompositionPreset;
  params: ShotParams;
}

function buildEntry(
  shotSize: ShotSize,
  shotSizeLabel: string,
  angle: CameraAngle,
  angleLabel: string,
  elevation: Elevation,
  elevationLabel: string,
  composition: CompositionPreset
): ShotLibraryEntry {
  return {
    id: `${shotSize}-${angle}-${elevation}-${composition.id}`,
    label: `${shotSizeLabel} · ${angleLabel} · ${elevationLabel} · ${composition.label}`,
    shotSize,
    shotSizeLabel,
    angle,
    angleLabel,
    elevation,
    elevationLabel,
    composition,
    params: { shotSize, angle, elevation, composition },
  };
}

export const SHOT_LIBRARY: ShotLibraryEntry[] = SHOT_SIZE_OPTIONS.flatMap(([shotSize, shotSizeLabel]) =>
  ANGLE_OPTIONS.flatMap(([angle, angleLabel]) =>
    ELEVATION_OPTIONS.flatMap(([elevation, elevationLabel]) =>
      COMPOSITION_PRESETS.map((composition) => buildEntry(shotSize, shotSizeLabel, angle, angleLabel, elevation, elevationLabel, composition))
    )
  )
);

/** Describes an arbitrary (shotSize, angle, elevation, composition) combination the same way the generated library does, for callers that pick axis values independently (e.g. the Shot Builder) rather than browsing the pre-generated set. */
export function describeShot(params: ShotParams): ShotLibraryEntry {
  const shotSizeLabel = SHOT_SIZE_OPTIONS.find(([id]) => id === params.shotSize)?.[1] ?? params.shotSize;
  const angleLabel = ANGLE_OPTIONS.find(([id]) => id === params.angle)?.[1] ?? params.angle;
  const elevationLabel = ELEVATION_OPTIONS.find(([id]) => id === params.elevation)?.[1] ?? params.elevation;
  return buildEntry(params.shotSize, shotSizeLabel, params.angle, angleLabel, params.elevation, elevationLabel, params.composition);
}

const EXPECTED_TOTAL = SHOT_SIZE_OPTIONS.length * ANGLE_OPTIONS.length * ELEVATION_OPTIONS.length * COMPOSITION_PRESETS.length;

/** The one runnable check for this module: the library must stay a pure generated product of the axis registries, never drift from their combined count. */
export function assertShotLibrarySize(): void {
  console.assert(
    SHOT_LIBRARY.length === EXPECTED_TOTAL,
    `[shotLibraryData] expected ${EXPECTED_TOTAL} generated combinations, got ${SHOT_LIBRARY.length}`
  );
  console.assert(new Set(SHOT_LIBRARY.map((entry) => entry.id)).size === SHOT_LIBRARY.length, "[shotLibraryData] duplicate entry ids found");
}
