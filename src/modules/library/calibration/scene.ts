/**
 * Shot Solver prototype scene: a single standing mannequin at the origin,
 * facing +Z (mannequin-js default front — see ../scene.ts's SEAT_A_ROTATION
 * comment). No table, no second figure — the solver only needs to prove
 * itself against one anchor character before OTS/two-character work begins.
 */
export const STANDING_MANNEQUIN_ID = "calibration-mannequin";
export const STANDING_POSITION: [number, number, number] = [0, 0, 0];
export const STANDING_ROTATION: [number, number, number] = [0, 0, 0];

/** Static context camera for the main viewport — a fixed 3/4 view of the figure. */
export const CONTEXT_CAMERA_CONFIG = { fov: 45, near: 0.02, far: 20, position: [2.6, 1.8, 3.4] as [number, number, number] };
export const CONTEXT_CAMERA_TARGET: [number, number, number] = [0, 0.9, 0];

export const SHOT_CAMERA_DEFAULT_FOV = 40;
export const SHOT_CAMERA_NEAR = 0.02;
export const SHOT_CAMERA_FAR = 12;
/** Placeholder pose before the first solve runs (as soon as the mannequin is ready). */
export const SHOT_CAMERA_DEFAULT_POSITION: [number, number, number] = [0, 1.5, 3.5];
export const SHOT_CAMERA_DEFAULT_TARGET: [number, number, number] = [0, 0.9, 0];
