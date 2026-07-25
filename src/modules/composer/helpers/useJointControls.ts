import { useCallback } from "react";
import * as THREE from "three";
import { getJoint, getDOF, setDOF, type JointConfig } from "./jointConfig";

export interface JointControlsAPI {
  /** Get current value of a DOF */
  getValue: (config: JointConfig, dofIndex: number) => number;
  /** Set a DOF value on the live mannequin and sync to store */
  setValue: (config: JointConfig, dofIndex: number, value: number) => void;
  /** Read full posture from mannequin */
  getPosture: () => { version: number; data: number[][] } | null;
}

export function useJointControls(
  mannequinRef: React.RefObject<THREE.Object3D | null>,
  onPostureChange?: (posture: { version: number; data: number[][] }) => void
): JointControlsAPI {
  const getValue = useCallback(
    (config: JointConfig, dofIndex: number): number => {
      const mannequin = mannequinRef.current;
      if (!mannequin) return 0;
      const joint = getJoint(mannequin, config.mannequinKey);
      if (!joint) return 0;
      return getDOF(joint, config.dofs[dofIndex].accessor);
    },
    [mannequinRef]
  );

  const setValue = useCallback(
    (config: JointConfig, dofIndex: number, value: number) => {
      const mannequin = mannequinRef.current;
      if (!mannequin) return;
      const joint = getJoint(mannequin, config.mannequinKey);
      if (!joint) return;
      setDOF(joint, config.dofs[dofIndex].accessor, value);
      mannequin.updateMatrixWorld(true);
      if (typeof (mannequin as any).stepOnGround === "function") {
        (mannequin as any).stepOnGround();
      }
      // Sync to store
      const posture = (mannequin as any).posture;
      if (posture && onPostureChange) {
        onPostureChange(posture);
      }
    },
    [mannequinRef, onPostureChange]
  );

  const getPosture = useCallback((): { version: number; data: number[][] } | null => {
    const mannequin = mannequinRef.current;
    if (!mannequin) return null;
    return (mannequin as any).posture ?? null;
  }, [mannequinRef]);

  return { getValue, setValue, getPosture };
}