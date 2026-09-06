import type { CameraAngle, Elevation, ShotSize } from "./shotSolver";

export const SHOT_SIZE_OPTIONS: [ShotSize, string][] = [
  ["wide", "Wide"],
  ["full", "Full"],
  ["medium", "Medium"],
  ["mcu", "MCU"],
  ["closeup", "Close-Up"],
];

export const ANGLE_OPTIONS: [CameraAngle, string][] = [
  ["front", "Front"],
  ["threeQuarterLeft", "3/4 Left"],
  ["threeQuarterRight", "3/4 Right"],
  ["profile", "Profile"],
  ["back", "Back"],
  ["ots", "Over the Shoulder"],
];

export const ELEVATION_OPTIONS: [Elevation, string][] = [
  ["eye", "Eye Level"],
  ["low", "Low"],
  ["high", "High"],
];
