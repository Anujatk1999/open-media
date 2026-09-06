import type { SceneTransform, Keyframe } from "../../stores/composerStore";
import { clonePosture, mirrorPosture, type Posture } from "../composer/helpers/posture";

/**
 * A motion preset builds a starting keyframe sequence from the object's
 * current transform plus whatever authored postures are available — it never
 * fabricates joint rotations. `requires` names which authored posture(s) a
 * preset needs so the panel can grey it out when that pose is missing from
 * the library instead of silently producing a posture-less stub.
 */
export interface MotionPresetContext {
  transform: SceneTransform;
  /** The object's neutral/rest posture, used as the "passing" frame between strides. */
  neutralPosture?: Posture;
  /** Whatever posture the object currently holds — used by presets that don't touch posture at all. */
  currentPosture?: Posture;
  walkPosture?: Posture;
  runPosture?: Posture;
}

export interface MotionPreset {
  id: string;
  label: string;
  requires: Array<"walk" | "run">;
  build: (ctx: MotionPresetContext) => Keyframe[];
}

function kf(time: number, transform: SceneTransform, posture: Posture | undefined): Keyframe {
  return {
    id: crypto.randomUUID(),
    time,
    transform: { position: [...transform.position], rotation: [...transform.rotation], scale: [...transform.scale] },
    posture: posture ? clonePosture(posture) : undefined,
  };
}

function withZOffset(transform: SceneTransform, dz: number): SceneTransform {
  return { ...transform, position: [transform.position[0], transform.position[1], transform.position[2] + dz] };
}

function withYaw(transform: SceneTransform, dyaw: number): SceneTransform {
  return { ...transform, rotation: [transform.rotation[0], transform.rotation[1] + dyaw, transform.rotation[2]] };
}

/**
 * Four sequential points — Start (the object's current position, exactly as
 * found) then three strides moving forward from it: Start → Point 2 → Point 3
 * → Point 4. "Forward" is +Z, the mannequin's own front — the "front" shot
 * angle sits its camera at +Z (see shotSolver's front/back z-sign assert), so
 * a figure at identity rotation faces +Z. Each point's z is strictly greater
 * than the last, so the path only ever advances, never doubles back.
 * `frameTime`/`step` set cadence and stride length so the same builder covers
 * Walk/Jog/Run — jog reuses the run posture at a slower cadence/shorter
 * stride since no dedicated jog pose is authored.
 */
function buildStride(ctx: MotionPresetContext, stride: Posture, frameTime: number, step: number): Keyframe[] {
  const mirrored = mirrorPosture(stride);
  const passing = ctx.neutralPosture ?? stride;
  const postures = [passing, stride, mirrored, passing];
  return postures.map((posture, i) => kf(i * frameTime, withZOffset(ctx.transform, i * step), posture));
}

/** `distance` is how far forward (+Z) the object moves while transitioning between postures. */
function buildTransition(ctx: MotionPresetContext, from: Posture | undefined, to: Posture | undefined, distance: number): Keyframe[] {
  return [kf(0, ctx.transform, from), kf(0.5, withZOffset(ctx.transform, distance), to)];
}

function buildTurn(ctx: MotionPresetContext, dyaw: number): Keyframe[] {
  return [kf(0, ctx.transform, ctx.currentPosture), kf(0.8, withYaw(ctx.transform, dyaw), ctx.currentPosture)];
}

export const MOTION_PRESETS: MotionPreset[] = [
  { id: "walk", label: "Walk", requires: ["walk"], build: (ctx) => buildStride(ctx, ctx.walkPosture!, 0.35, 0.45) },
  { id: "jog", label: "Jog", requires: ["run"], build: (ctx) => buildStride(ctx, ctx.runPosture!, 0.3, 0.55) },
  { id: "run", label: "Run", requires: ["run"], build: (ctx) => buildStride(ctx, ctx.runPosture!, 0.2, 0.75) },
  { id: "walk-start", label: "Walk Start", requires: ["walk"], build: (ctx) => buildTransition(ctx, ctx.neutralPosture, ctx.walkPosture, 0.3) },
  { id: "walk-stop", label: "Walk Stop", requires: ["walk"], build: (ctx) => buildTransition(ctx, ctx.walkPosture, ctx.neutralPosture, 0.3) },
  { id: "run-start", label: "Run Start", requires: ["run"], build: (ctx) => buildTransition(ctx, ctx.neutralPosture, ctx.runPosture, 0.5) },
  { id: "run-stop", label: "Run Stop", requires: ["run"], build: (ctx) => buildTransition(ctx, ctx.runPosture, ctx.neutralPosture, 0.5) },
  { id: "turn-left", label: "Turn Left", requires: [], build: (ctx) => buildTurn(ctx, Math.PI / 2) },
  { id: "turn-right", label: "Turn Right", requires: [], build: (ctx) => buildTurn(ctx, -Math.PI / 2) },
];
