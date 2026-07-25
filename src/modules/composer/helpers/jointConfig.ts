/** A single degree-of-freedom on a joint */
export interface JointDOF {
  /** Display label, e.g. "Bend", "Raise" */
  label: string;
  /** The accessor property name on the joint object (getter/setter) */
  accessor: string;
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

/**
 * Get a DOF value from a joint.
 * e.g. getDOF(mannequin.l_arm, "raise") → number
 */
export function getDOF(joint: any, accessor: string): number {
  // Some joints have named getters (e.g. arm.raise), others use raw x/y/z
  if (typeof joint[accessor] === "number") {
    // It's a plain property (e.g. raw x/y/z stored as degrees on the joint)
    return joint[accessor];
  }
  // It's a getter/setter
  return joint[accessor];
}

/**
 * Set a DOF value on a joint.
 */
export function setDOF(joint: any, accessor: string, value: number): void {
  if (typeof joint[accessor] === "number") {
    joint[accessor] = value;
  } else {
    joint[accessor] = value;
  }
}

/** Full joint configuration list */
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
    label: "Pelvis",
    mannequinKey: "pelvis",
    dofs: [
      { label: "X", accessor: "x", min: -30, max: 30, step: 1 },
      { label: "Y", accessor: "y", min: -30, max: 30, step: 1 },
      { label: "Z", accessor: "z", min: -30, max: 30, step: 1 },
    ],
  },
  {
    label: "Neck",
    mannequinKey: "neck",
    dofs: [
      { label: "X", accessor: "x", min: -22, max: 22, step: 1 },
      { label: "Y", accessor: "y", min: -45, max: 45, step: 1 },
      { label: "Z", accessor: "z", min: -60, max: 25, step: 1 },
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
];