import { useEffect, useRef } from "react";
import * as THREE from "three";
import { useThree } from "@react-three/fiber";
import { useComposerStore } from "../../stores/composerStore";

/**
 * PoseControls — viewport-based joint pose editing.
 *
 * Mirrors the official mannequin-js interaction model:
 * - Pointer down: raycast into scene to find a body-part mesh → walk up to
 *   the corresponding mannequin Joint → select it (green glow)
 * - Pointer move: run IK on each DOF axis, testing small deltas to find the
 *   direction that drags the click-point toward the cursor on screen
 * - Pointer up: deselect joint, re-enable orbit controls
 *
 * Uses DOM-level pointer events (not R3F event system) so we can raycast
 * against ALL meshes in the scene, including the mannequin body parts.
 */
export default function PoseControls() {
  const { camera, gl } = useThree();
  const activeTool = useComposerStore((s) => s.activeTool);
  const selectedId = useComposerStore((s) => s.selectedMannequinId);
  const updatePosture = useComposerStore((s) => s.updateMannequinPosture);
  const isPoseMode = activeTool === "pose";

  // Per-drag state
  const jointRef = useRef<any>(null);
  const dragPoint = useRef(new THREE.Vector3());
  const mouseScreen = useRef(new THREE.Vector2());
  const isDragging = useRef(false);
  const mannequinRef = useRef<any>(null);

  // Cleanup on mode change
  useEffect(() => {
    if (!isPoseMode) {
      if (jointRef.current) {
        jointRef.current.select(false);
        jointRef.current = null;
      }
      isDragging.current = false;
    }
  }, [isPoseMode]);

  useEffect(() => {
    if (!isPoseMode) return;

    const domElement = gl.domElement;
    const scene = (camera as any).parent?.parent;
    if (!scene) return;

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();

    const onPointerDown = (event: PointerEvent) => {
      if (!selectedId) return;

      pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
      pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);

      // Find the mannequin instance inside the scene
      let mannequinObj: any = null;
      scene.traverse((child: any) => {
        if (child.body && child.torso && child.posture) {
          mannequinObj = child;
        }
      });
      if (!mannequinObj) return;

      // Collect candidate meshes from mannequin and its children
      const candidates: THREE.Object3D[] = [];
      mannequinObj.traverse((child: any) => {
        if (child.isMesh) {
          candidates.push(child);
        }
      });

      const intersects = raycaster.intersectObjects(candidates, false);
      if (intersects.length === 0) return;

      const hitMesh = intersects[0].object;

      // Walk up from the hit mesh to find the nearest Joint (has .select, .posture, .minRot etc.)
      let foundJoint: any = null;
      let walk: any = hitMesh;
      const mannequinKeys: string[] = [];
      for (const key of Object.keys(mannequinObj)) {
        if (typeof mannequinObj[key] === "object" && mannequinObj[key]?.isObject3D) {
          mannequinKeys.push(key);
        }
      }

      // Walk up parent chain from hit mesh
      while (walk) {
        // Check if walk corresponds to a mannequin joint key
        for (const key of mannequinKeys) {
          if (mannequinObj[key] === walk && typeof walk.select === "function") {
            foundJoint = walk;
            break;
          }
        }
        if (foundJoint) break;
        walk = walk.parent;
      }

      // Fallback: traverse from root to find which joint's image contains the hit mesh
      if (!foundJoint) {
        mannequinObj.traverse((child: any) => {
          if (typeof child.select === "function" && child.image) {
            let hitInImage = false;
            child.image.traverse((imgChild: any) => {
              if (imgChild === hitMesh) hitInImage = true;
            });
            if (child.imageWrapper) {
              child.imageWrapper.traverse((imgChild: any) => {
                if (imgChild === hitMesh) hitInImage = true;
              });
            }
            if (hitInImage) {
              foundJoint = child;
            }
          }
        });
      }

      if (!foundJoint) return;

      // Deselect previous
      if (jointRef.current) {
        jointRef.current.select(false);
      }

      // Select new joint
      foundJoint.select(true);
      jointRef.current = foundJoint;
      mannequinRef.current = mannequinObj;
      isDragging.current = true;

      // Store hit point in the joint's image local space for IK projection
      const worldPt = intersects[0].point;
      // Store world-space point — we'll project it per-frame in the IK loop
      dragPoint.current.copy(worldPt);

      // Disable orbit controls
      const orbit = (camera as any).__orbitControls;
      if (orbit) orbit.enabled = false;

      domElement.setPointerCapture(event.pointerId);
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!isDragging.current || !jointRef.current) return;

      mouseScreen.current.x = (event.clientX / window.innerWidth) * 2 - 1;
      mouseScreen.current.y = -(event.clientY / window.innerHeight) * 2 + 1;

      const joint = jointRef.current;

      // Determine which DOF axes this joint supports
      const axes = getJointAxes(joint);

      // Run IK on each axis — test small deltas to find direction
      for (const axis of axes) {
        runIK(joint, axis, dragPoint.current, mouseScreen.current, camera, 0.5);
      }

      joint.updateMatrixWorld(true);

      // Sync posture to store
      const m = mannequinRef.current;
      if (m && selectedId) {
        try {
          const posture = m.posture;
          if (posture) {
            updatePosture(selectedId, posture);
          }
        } catch {
          // Silently skip
        }
      }
    };

    const onPointerUp = (event: PointerEvent) => {
      if (!isDragging.current) return;
      isDragging.current = false;

      if (jointRef.current) {
        jointRef.current.select(false);
        jointRef.current = null;
      }
      mannequinRef.current = null;

      const orbit = (camera as any).__orbitControls;
      if (orbit) orbit.enabled = true;

      domElement.releasePointerCapture(event.pointerId);
    };

    domElement.addEventListener("pointerdown", onPointerDown);
    domElement.addEventListener("pointermove", onPointerMove);
    domElement.addEventListener("pointerup", onPointerUp);

    return () => {
      domElement.removeEventListener("pointerdown", onPointerDown);
      domElement.removeEventListener("pointermove", onPointerMove);
      domElement.removeEventListener("pointerup", onPointerUp);
    };
  }, [isPoseMode, camera, gl, selectedId, updatePosture]);

  return null;
}

// ─── IK helpers ───────────────────────────────────────────────────────

/**
 * Test a small rotation on the given axis, project the drag point to screen,
 * and check if it moves closer to the mouse cursor. If yes, keep the rotation.
 */
function runIK(
  joint: any,
  axis: string,
  dragPtWorld: THREE.Vector3,
  mouse: THREE.Vector2,
  camera: THREE.Camera,
  stepSize: number
) {
  // Convert drag point to joint-local space for projection
  const screenPt = new THREE.Vector3().copy(dragPtWorld).project(camera);
  const distOrig = mouse.distanceTo(new THREE.Vector2(screenPt.x, screenPt.y));

  const oldVal = joint[axis];

  // Test positive delta
  joint[axis] = oldVal + 0.05;
  joint.updateMatrixWorld(true);
  const pPos = new THREE.Vector3().copy(dragPtWorld).project(camera);
  const dPos = mouse.distanceTo(new THREE.Vector2(pPos.x, pPos.y));

  // Restore
  joint[axis] = oldVal;
  joint.updateMatrixWorld(true);

  // Test negative delta
  joint[axis] = oldVal - 0.05;
  joint.updateMatrixWorld(true);
  const pNeg = new THREE.Vector3().copy(dragPtWorld).project(camera);
  const dNeg = mouse.distanceTo(new THREE.Vector2(pNeg.x, pNeg.y));

  // Restore
  joint[axis] = oldVal;
  joint.updateMatrixWorld(true);

  // Neither direction helped — bail
  if (dPos >= distOrig && dNeg >= distOrig) return;

  // Move in the better direction
  const dir = dPos < dNeg ? 1 : -1;
  joint[axis] = oldVal + dir * stepSize;
  joint.updateMatrixWorld(true);
}

/**
 * Determine which DOF axes are available on a joint.
 * mannequin-js joints expose named angle getters/setters.
 * The exact set depends on the joint type:
 *   - arms/legs: raise, straddle, turn
 *   - elbows/knees: bend
 *   - wrists/ankles: bend, tilt, turn
 *   - head: nod, tilt, turn
 *   - body/torso/pelvis: bend, tilt, turn
 *   - raw Euler: x, y, z
 */
function getJointAxes(joint: any): string[] {
  const axes: string[] = [];
  const candidates = [
    "bend", "tilt", "turn", "raise", "straddle", "nod",
    "x", "y", "z",
  ];
  for (const c of candidates) {
    try {
      const v = joint[c];
      if (typeof v === "number") {
        axes.push(c);
      }
    } catch {
      // Skip accessors that throw during read
    }
  }
  return axes;
}