/**
 * mannequin-js posture v7 — the only serialized pose format.
 *
 * Entry order and lengths are fixed by `Mannequin.posture`
 * (mannequin-js 5.2.3, src/bodies/Mannequin.js:204). Entries are NOT uniform
 * XYZ triples: index 0 is a position, knees and elbows are a single z-bend,
 * and a finger carries its mid/tip phalanges in the same entry.
 *
 * `pelvis` and `neck` are real joints in the chain (body → pelvis → torso →
 * neck → head) but are absent here, so any rotation applied to them is lost on
 * save. They are deliberately not exposed as editable — see jointConfig.ts.
 */

export const POSTURE_VERSION = 7;

/** Serialized entry names, in order. Index 0 is `body.position`, the rest are rotations. */
export const POSTURE_ENTRIES = [
  "body.position",
  "body",
  "torso",
  "head",
  "l_leg",
  "l_knee",
  "l_ankle",
  "r_leg",
  "r_knee",
  "r_ankle",
  "l_arm",
  "l_elbow",
  "l_wrist",
  "l_finger_0",
  "l_finger_1",
  "l_finger_2",
  "l_finger_3",
  "l_finger_4",
  "r_arm",
  "r_elbow",
  "r_wrist",
  "r_finger_0",
  "r_finger_1",
  "r_finger_2",
  "r_finger_3",
  "r_finger_4",
] as const;

/**
 * Values per entry, index-aligned with POSTURE_ENTRIES.
 * 3 = [x,y,z] · 1 = [z] for Elbow/Knee · 7 = [x,y,z] + mid[x,z] + tip[x,z] for a Finger.
 */
export const POSTURE_ENTRY_LENGTHS = [
  3, 3, 3, 3, 3, 1, 3, 3, 1, 3, 3, 1, 3, 7, 7, 7, 7, 7, 3, 1, 3, 7, 7, 7, 7, 7,
];

export type JointEuler = [number, number, number];

export interface Posture {
  version: number;
  data: number[][];
  /**
   * Full euler in degrees for the joints v7 cannot hold, keyed by joint. Absent
   * on the bundled pose files, which predate it. See LOSSY_JOINTS.
   */
  extra?: Record<string, JointEuler>;
}

/**
 * `Elbow.posture` and `Knee.posture` serialize a single number — `rotation.z`,
 * the bend — so the x and y a gizmo drag puts on them are dropped on save. That
 * is the forearm/shin twist praying hands and crossed arms need, so it is kept
 * in `Posture.extra` instead. mannequin-js reads only `version` and `data`, so
 * the field rides along through `figure.posture = …` untouched, and the v7
 * structure itself is unchanged.
 */
export const LOSSY_JOINTS = ["l_elbow", "r_elbow", "l_knee", "r_knee"] as const;

const toDeg = (r: number) => (r * 180) / Math.PI;
const toRad = (d: number) => (d * Math.PI) / 180;

/** The figure's v7 posture plus the axes v7 alone would lose. */
export function readPosture(figure: any): Posture {
  const extra: Record<string, JointEuler> = {};
  for (const key of LOSSY_JOINTS) {
    const joint = figure?.[key];
    if (!joint) continue;
    joint.rotation.reorder("XYZ");
    extra[key] = [toDeg(joint.rotation.x), toDeg(joint.rotation.y), toDeg(joint.rotation.z)];
  }
  return { ...(figure.posture as Posture), extra };
}

/** Applies a posture, then restores the axes `.posture` on its own would zero. */
export function writePosture(figure: any, posture: Posture): void {
  figure.posture = posture;
  for (const key of LOSSY_JOINTS) {
    const euler = posture.extra?.[key];
    const joint = figure?.[key];
    if (euler && joint) {
      joint.rotation.set(toRad(euler[0]), toRad(euler[1]), toRad(euler[2]), "XYZ");
    }
  }
  figure.updateMatrixWorld(true);
}

/**
 * Why `value` is not a valid v7 posture, or null if it is.
 * Names the offending entry so a bad pose file points at its own problem.
 */
export function describePostureError(value: unknown): string | null {
  if (!value || typeof value !== "object") return "posture is not an object";

  const posture = value as Partial<Posture>;

  if (posture.version !== POSTURE_VERSION) {
    return `unsupported posture version ${String(posture.version)} (expected ${POSTURE_VERSION})`;
  }
  if (!Array.isArray(posture.data)) return "posture.data is not an array";
  if (posture.data.length !== POSTURE_ENTRY_LENGTHS.length) {
    return `posture.data has ${posture.data.length} entries (expected ${POSTURE_ENTRY_LENGTHS.length})`;
  }

  for (let i = 0; i < posture.data.length; i++) {
    const entry = posture.data[i];
    const expected = POSTURE_ENTRY_LENGTHS[i];
    const name = POSTURE_ENTRIES[i];

    if (!Array.isArray(entry)) return `posture.data[${i}] (${name}) is not an array`;
    if (entry.length !== expected) {
      return `posture.data[${i}] (${name}) has ${entry.length} values (expected ${expected})`;
    }
    for (let j = 0; j < entry.length; j++) {
      if (!Number.isFinite(entry[j])) {
        return `posture.data[${i}] (${name})[${j}] is not a finite number`;
      }
    }
  }

  return null;
}

export function isValidPosture(value: unknown): value is Posture {
  return describePostureError(value) === null;
}

/** Deep copy, so stored postures never alias the live figure's arrays. */
export function clonePosture(posture: Posture): Posture {
  const clone: Posture = { ...posture, data: posture.data.map((entry) => [...entry]) };
  if (posture.extra) {
    clone.extra = Object.fromEntries(
      Object.entries(posture.extra).map(([key, euler]) => [key, [...euler] as JointEuler]),
    );
  }
  return clone;
}
