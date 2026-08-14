/**
 * One-way mirroring for the pose editor: copy the selected side's angles onto
 * the opposite side, either for one joint or for its whole limb chain.
 *
 * Copies mannequin's own named angles, never raw rotations. Every named setter
 * already applies its own per-side sign flip, so assigning the same value to the
 * opposite joint produces the mirrored pose without this file knowing a single
 * axis or sign.
 *
 * Distinct from motion.ts's `mirrorPosture`, which swaps both sides of a whole
 * posture to build a walk cycle. This one overwrites one side from the other.
 *
 * Ported from 3JS-Shot-composer/pose-author.html.
 */

const MIRROR_PROPS: Record<string, string[]> = {
  arm: ["raise", "straddle", "turn"],
  leg: ["raise", "straddle", "turn"],
  elbow: ["bend"],
  knee: ["bend"],
  wrist: ["bend", "tilt", "turn"],
  ankle: ["bend", "tilt", "turn"],
  finger: ["bend", "straddle", "turn"],
};

const LIMB_CHAINS = [
  ["arm", "elbow", "wrist", "finger_0", "finger_1", "finger_2", "finger_3", "finger_4"],
  ["leg", "knee", "ankle"],
];

/** The side a joint key belongs to, or null for body/torso/head, which cannot mirror. */
export function sideOf(key: string | null): "l" | "r" | null {
  if (!key) return null;
  if (key.startsWith("l_")) return "l";
  if (key.startsWith("r_")) return "r";
  return null;
}

export function mirrorJoint(figure: any, key: string, wholeLimb: boolean): void {
  const side = sideOf(key);
  if (!side) return;

  const part = key.slice(2);
  const parts = wholeLimb ? LIMB_CHAINS.find((c) => c.includes(part)) ?? [part] : [part];
  const other = side === "l" ? "r" : "l";

  for (const p of parts) {
    const src = figure[`${side}_${p}`];
    const dst = figure[`${other}_${p}`];
    if (!src || !dst) continue;
    for (const prop of MIRROR_PROPS[p.startsWith("finger") ? "finger" : p] ?? []) {
      dst[prop] = src[prop];
    }
    if (p.startsWith("finger")) {
      dst.mid.bend = src.mid.bend;
      dst.tip.bend = src.tip.bend;
    }
  }
  figure.updateMatrixWorld(true);
}
