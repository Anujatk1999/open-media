/**
 * Looping motion for the mannequin, built out of a single saved pose.
 *
 * A stride and its own mirror image are the two halves of a walk cycle, so one
 * authored pose is already a whole loop: blend from the pose to its mirror and
 * back, and the figure walks. The interpolation is mannequin.js's own blend(),
 * so no angle maths lives here.
 *
 * Mirroring goes through mannequin's named angles (raise, straddle, bend, ...)
 * and never through raw rotations, because each named setter already folds in
 * its own per-side sign flip. This file hard-codes no axis and no sign.
 *
 * Ported from 3JS-Shot-composer/src/lib/motion.js.
 */

import { blend } from "mannequin-js/src/mannequin.js";
import type { Posture } from "./posture";

// Fingers are deliberately absent: a walk never shows them, and each finger
// carries mid/tip phalanges that would have to be swapped as well.
const SWAP_PROPS: Record<string, string[]> = {
  leg: ["raise", "straddle", "turn"],
  knee: ["bend"],
  ankle: ["bend", "tilt", "turn"],
  arm: ["raise", "straddle", "turn"],
  elbow: ["bend"],
  wrist: ["bend", "tilt", "turn"],
};

export interface MotionDef {
  label: string;
  seconds: number;
  poseId?: string;
  mirror?: boolean;
  keys?: Record<string, Record<string, number>>[];
}

/**
 * The left/right swapped copy of `posture`. Borrows `figure` to do the
 * conversion, since mannequin's own accessors are the only thing that knows the
 * per-side signs, and puts the figure's posture back before returning.
 */
export function mirrorPosture(figure: any, posture: Posture): Posture {
  const original = figure.posture;
  figure.posture = posture;

  // read both sides before writing either: this is a swap, not a copy
  const held = new Map<string, number[]>();
  for (const [part, props] of Object.entries(SWAP_PROPS)) {
    for (const side of ["l", "r"]) {
      const joint = figure[`${side}_${part}`];
      held.set(`${side}_${part}`, props.map((prop) => joint[prop]));
    }
  }
  for (const [part, props] of Object.entries(SWAP_PROPS)) {
    for (const [from, to] of [["l", "r"], ["r", "l"]]) {
      const values = held.get(`${from}_${part}`)!;
      const joint = figure[`${to}_${part}`];
      props.forEach((prop, i) => { joint[prop] = values[i]; });
    }
  }

  const mirrored = figure.posture;
  figure.posture = original;
  return mirrored;
}

/**
 * `base` with the named angles in `deltas` added to it. Additive, so a keyframe
 * is a departure from whatever pose the figure is standing in rather than an
 * absolute posture that would throw that pose away.
 */
function nudge(figure: any, base: Posture, deltas: Record<string, Record<string, number>>): Posture {
  const original = figure.posture;
  figure.posture = base;
  for (const [joint, props] of Object.entries(deltas)) {
    for (const [prop, delta] of Object.entries(props)) figure[joint][prop] += delta;
  }
  const result = figure.posture;
  figure.posture = original;
  return result;
}

/**
 * keys[0] -> keys[1] -> ... -> keys[0] over `seconds`, as sample(elapsed).
 *
 * Cosine easing across each segment rather than a straight lerp, so the joins
 * have no visible flick where the direction reverses. With two keys this is
 * exactly the plain A -> B -> A ping-pong the walk cycle uses.
 */
function createLoop(keys: Posture[], seconds: number) {
  return (elapsed: number): Posture => {
    const t = ((((elapsed / seconds) % 1) + 1) % 1) * keys.length;
    const i = Math.floor(t);
    const k = 0.5 - 0.5 * Math.cos(Math.PI * (t - i));
    return blend(keys[i], keys[(i + 1) % keys.length], k);
  };
}

/**
 * Turns a MOTIONS entry into sample(seconds) -> posture.
 *
 * Two kinds of motion, and that is the whole system: `mirror` ones are a saved
 * pose against its own left/right swap, `keys` ones are a list of angle nudges
 * off `base`. A new motion is one more entry in MOTIONS, not new code here.
 */
export function createMotion(figure: any, motion: MotionDef, base: Posture) {
  const keys = motion.mirror
    ? [base, mirrorPosture(figure, base)]
    : (motion.keys ?? []).map((deltas) => nudge(figure, base, deltas));
  return createLoop(keys, motion.seconds);
}

/**
 * Motion catalogue.
 *
 * Walk and Run each ride an authored pose. Kick and Idle have no authored pose
 * to ride, so they are written as angle nudges — small enough to read at a
 * glance, and sign-free because they name mannequin's own angles.
 */
export const MOTIONS: Record<string, MotionDef> = {
  walk: {
    label: "Walk",
    poseId: "authored.walking-forward",
    mirror: true,
    seconds: 1.2,
  },

  run: {
    label: "Run",
    poseId: "authored.running-with-right-hand-forward",
    mirror: true,
    seconds: 0.7, // same cycle as the walk, roughly twice the cadence
  },

  // Right-leg front kick: settle, wind the leg back with the knee folded, then
  // snap it straight out while the torso counter-leans. The loop's own wrap
  // carries the leg back down, so the recovery needs no key of its own.
  kick: {
    label: "Kick",
    seconds: 1.6,
    keys: [
      {},
      {
        r_leg: { raise: -20 }, r_knee: { bend: 45 },
        torso: { bend: 6 }, l_knee: { bend: 8 },
      },
      {
        r_leg: { raise: 55 }, r_ankle: { bend: -15 },
        torso: { bend: -12 }, l_knee: { bend: 12 },
        r_arm: { raise: -25 }, l_arm: { raise: 20, straddle: 8 },
      },
    ],
  },

  // Standing still is never actually still. Four keys so the head nods twice
  // per cycle while the weight shifts across once — the two rhythms stop it
  // reading as a single machine oscillation. Nothing here exceeds ~5 degrees.
  idle: {
    label: "Idle",
    seconds: 4,
    keys: [
      {},
      {
        torso: { tilt: 3, turn: 2 }, head: { nod: 3, turn: -3 },
        l_knee: { bend: 4 }, r_leg: { straddle: 1 },
      },
      { torso: { bend: 2 }, head: { nod: -2 } }, // breath
      {
        torso: { tilt: -3, turn: -2 }, head: { nod: 3, turn: 3 },
        r_knee: { bend: 4 }, l_leg: { straddle: 1 },
      },
    ],
  },
};
