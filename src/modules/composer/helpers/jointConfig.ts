/** A single degree-of-freedom on a joint */
export interface JointDOF {
  /** Display label, e.g. "Bend", "Raise" */
  label: string;
  /** The accessor property name on the joint object (getter/setter) */
  accessor: string;
  /** Sub-joint the accessor lives on. Fingers carry their phalanges as `.mid` / `.tip`. */
  on?: "mid" | "tip";
  /** Minimum angle in degrees */
  min: number;
  /** Maximum angle in degrees */
  max: number;
  /** Slider step */
  step: number;
}

/** Config for one joint/section displayed in the UI */
export interface JointConfig {
  /** Display section label, e.g. "Left Arm" */
  label: string;
  /** The property path on the mannequin to access this joint, e.g. "l_arm" */
  mannequinKey: string;
  /** Per-axis degrees of freedom */
  dofs: JointDOF[];
}

/**
 * Returns the joint object from a mannequin instance.
 * e.g. getJoint(mannequin, "l_arm") → mannequin.l_arm
 */
export function getJoint(mannequin: any, key: string): any {
  return (mannequin as any)[key];
}

/** The object the DOF's accessor actually lives on — the joint, or one of its phalanges. */
function dofTarget(joint: any, dof: JointDOF): any {
  return dof.on ? joint?.[dof.on] : joint;
}

/**
 * Get a DOF value in degrees.
 * e.g. getDOF(mannequin.l_arm, { accessor: "raise", ... }) → number
 */
export function getDOF(joint: any, dof: JointDOF): number {
  return dofTarget(joint, dof)?.[dof.accessor] ?? 0;
}

/** Set a DOF value in degrees. */
export function setDOF(joint: any, dof: JointDOF, value: number): void {
  const target = dofTarget(joint, dof);
  if (target) target[dof.accessor] = value;
}

const FINGER_NAMES = ["Thumb", "Index", "Middle", "Ring", "Little"];

/** Straddle range per finger index, from Finger.js `minXbase`/`maxXbase`. Side-independent. */
const FINGER_STRADDLE: [number, number][] = [
  [-50, 0],
  [-35, 20],
  [-15, 15],
  [-15, 25],
  [-20, 35],
];

/**
 * A finger is one posture entry carrying its own [x,y,z] plus mid/tip bends,
 * so all five DOFs below belong to the same `l_finger_n` / `r_finger_n` key.
 * The thumb is the only finger with a meaningful turn.
 */
function fingerConfig(side: "l" | "r", n: number): JointConfig {
  const thumb = n === 0;
  const [straddleMin, straddleMax] = FINGER_STRADDLE[n];
  const dofs: JointDOF[] = [
    { label: "Bend", accessor: "bend", min: thumb ? -90 : -10, max: thumb ? 45 : 120, step: 1 },
    { label: "Straddle", accessor: "straddle", min: straddleMin, max: straddleMax, step: 1 },
  ];
  if (thumb) dofs.push({ label: "Turn", accessor: "turn", min: 90, max: 180, step: 1 });
  dofs.push({ label: "Mid Bend", accessor: "bend", on: "mid", min: 0, max: thumb ? 90 : 120, step: 1 });
  dofs.push({ label: "Tip Bend", accessor: "bend", on: "tip", min: 0, max: thumb ? 90 : 120, step: 1 });
  return {
    label: `${side === "l" ? "Left" : "Right"} ${FINGER_NAMES[n]}`,
    mannequinKey: `${side}_finger_${n}`,
    dofs,
  };
}

/**
 * Every joint the v7 posture serializes, in POSTURE_ENTRIES order per limb.
 * `pelvis` and `neck` are omitted on purpose: they exist in the chain but are
 * absent from `posture.data`, so edits to them are silently lost on save.
 */
export const JOINT_CONFIGS: JointConfig[] = [
  {
    label: "Body",
    mannequinKey: "body",
    dofs: [
      { label: "Bend", accessor: "bend", min: -50, max: 50, step: 1 },
      { label: "Tilt", accessor: "tilt", min: -50, max: 50, step: 1 },
      { label: "Turn", accessor: "turn", min: -90, max: 90, step: 1 },
    ],
  },
  {
    label: "Torso",
    mannequinKey: "torso",
    dofs: [
      { label: "Bend", accessor: "bend", min: -60, max: 25, step: 1 },
      { label: "Tilt", accessor: "tilt", min: -25, max: 25, step: 1 },
      { label: "Turn", accessor: "turn", min: -50, max: 50, step: 1 },
    ],
  },
  {
    label: "Head",
    mannequinKey: "head",
    dofs: [
      { label: "Nod", accessor: "nod", min: -25, max: 25, step: 1 },
      { label: "Tilt", accessor: "tilt", min: -22, max: 22, step: 1 },
      { label: "Turn", accessor: "turn", min: -45, max: 45, step: 1 },
    ],
  },
  {
    label: "Left Arm",
    mannequinKey: "l_arm",
    dofs: [
      { label: "Raise", accessor: "raise", min: -90, max: 180, step: 1 },
      { label: "Straddle", accessor: "straddle", min: -90, max: 90, step: 1 },
      { label: "Turn", accessor: "turn", min: -90, max: 90, step: 1 },
    ],
  },
  {
    label: "Right Arm",
    mannequinKey: "r_arm",
    dofs: [
      { label: "Raise", accessor: "raise", min: -90, max: 180, step: 1 },
      { label: "Straddle", accessor: "straddle", min: -90, max: 90, step: 1 },
      { label: "Turn", accessor: "turn", min: -90, max: 90, step: 1 },
    ],
  },
  {
    label: "Left Elbow",
    mannequinKey: "l_elbow",
    dofs: [
      { label: "Bend", accessor: "bend", min: 0, max: 150, step: 1 },
    ],
  },
  {
    label: "Right Elbow",
    mannequinKey: "r_elbow",
    dofs: [
      { label: "Bend", accessor: "bend", min: 0, max: 150, step: 1 },
    ],
  },
  {
    label: "Left Wrist",
    mannequinKey: "l_wrist",
    dofs: [
      { label: "Bend", accessor: "bend", min: -20, max: 35, step: 1 },
      { label: "Tilt", accessor: "tilt", min: -90, max: 90, step: 1 },
      { label: "Turn", accessor: "turn", min: -90, max: 90, step: 1 },
    ],
  },
  {
    label: "Right Wrist",
    mannequinKey: "r_wrist",
    dofs: [
      { label: "Bend", accessor: "bend", min: -35, max: 20, step: 1 },
      { label: "Tilt", accessor: "tilt", min: -90, max: 90, step: 1 },
      { label: "Turn", accessor: "turn", min: -90, max: 90, step: 1 },
    ],
  },
  {
    label: "Left Leg",
    mannequinKey: "l_leg",
    dofs: [
      { label: "Raise", accessor: "raise", min: -60, max: 90, step: 1 },
      { label: "Straddle", accessor: "straddle", min: -30, max: 60, step: 1 },
      { label: "Turn", accessor: "turn", min: -60, max: 60, step: 1 },
    ],
  },
  {
    label: "Right Leg",
    mannequinKey: "r_leg",
    dofs: [
      { label: "Raise", accessor: "raise", min: -60, max: 90, step: 1 },
      { label: "Straddle", accessor: "straddle", min: -60, max: 30, step: 1 },
      { label: "Turn", accessor: "turn", min: -60, max: 60, step: 1 },
    ],
  },
  {
    label: "Left Knee",
    mannequinKey: "l_knee",
    dofs: [
      { label: "Bend", accessor: "bend", min: 0, max: 150, step: 1 },
    ],
  },
  {
    label: "Right Knee",
    mannequinKey: "r_knee",
    dofs: [
      { label: "Bend", accessor: "bend", min: 0, max: 150, step: 1 },
    ],
  },
  {
    label: "Left Ankle",
    mannequinKey: "l_ankle",
    dofs: [
      { label: "Bend", accessor: "bend", min: -70, max: 80, step: 1 },
      { label: "Tilt", accessor: "tilt", min: -25, max: 25, step: 1 },
      { label: "Turn", accessor: "turn", min: -30, max: 30, step: 1 },
    ],
  },
  {
    label: "Right Ankle",
    mannequinKey: "r_ankle",
    dofs: [
      { label: "Bend", accessor: "bend", min: -70, max: 80, step: 1 },
      { label: "Tilt", accessor: "tilt", min: -25, max: 25, step: 1 },
      { label: "Turn", accessor: "turn", min: -30, max: 30, step: 1 },
    ],
  },
  ...[0, 1, 2, 3, 4].map((n) => fingerConfig("l", n)),
  ...[0, 1, 2, 3, 4].map((n) => fingerConfig("r", n)),
];