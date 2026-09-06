/**
 * Direct viewport-camera navigation ("Lock Camera to View" style), replacing
 * OrbitControls' pivot-locked model. Position and orientation change
 * independently, so OTS/close-up/asymmetric framings — camera near subject A,
 * aimed at subject B — are reachable, which a single fixed orbit pivot can't
 * express.
 *
 * Modes, chosen to match Blender/Unity viewport conventions users already know:
 *  - Left-drag: orbit around a pivot re-picked (at the current view distance)
 *    each time a drag starts, so orbiting never snaps back to scene center.
 *  - Right-drag: free-look (yaw/pitch in place, position unchanged) — the
 *    move OTS and asymmetric shots need, independent of any pivot.
 *  - Middle-drag / Shift+Left-drag: pan.
 *  - Wheel: dolly along the view direction.
 *  - WASD + Q/E (held): fly through XYZ space at a constant speed.
 */
import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

const LOOK_SPEED = 0.0035;
const PAN_SPEED = 0.0025;
const DOLLY_STEP = 0.08;
const FLY_SPEED = 2.5;
const FLY_SPEED_FAST = 6.5;
const PITCH_LIMIT = Math.PI / 2 - 0.01;

type DragMode = "none" | "orbit" | "look" | "pan";

function forwardOf(camera: THREE.Camera) {
  return new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
}
function rightOf(camera: THREE.Camera) {
  return new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
}
function upOf(camera: THREE.Camera) {
  return new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
}

export interface FreeCameraControls {
  /** Re-derive internal yaw/pitch from the camera's current quaternion, and
   * (if a target is given) the pan/dolly/orbit-pivot distance from the
   * camera-to-target distance — call after externally repositioning the
   * camera (e.g. reapplying a template) so drags don't snap back to the
   * pre-reapply orientation or use a stale distance (too coarse/fine a pan
   * step for the new framing, especially on close-ups). */
  syncOrientation: (target?: THREE.Vector3) => void;
}

export function useFreeCameraControls(
  camera: THREE.PerspectiveCamera,
  enabled: boolean,
  initialPivotDistance: number
): FreeCameraControls {
  const { gl } = useThree();
  const yaw = useRef(0);
  const pitch = useRef(0);
  const pivotDistance = useRef(initialPivotDistance);
  const pivot = useRef(new THREE.Vector3());
  const dragMode = useRef<DragMode>("none");
  const lastPointer = useRef({ x: 0, y: 0 });
  const keys = useRef<Set<string>>(new Set());

  const syncOrientation = (target?: THREE.Vector3) => {
    const euler = new THREE.Euler().setFromQuaternion(camera.quaternion, "YXZ");
    yaw.current = euler.y;
    pitch.current = euler.x;
    if (target) pivotDistance.current = camera.position.distanceTo(target);
  };

  useEffect(() => syncOrientation(), [camera]);

  useEffect(() => {
    if (!enabled) return;
    const el = gl.domElement;

    const applyLook = (dx: number, dy: number) => {
      yaw.current -= dx * LOOK_SPEED;
      pitch.current = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, pitch.current - dy * LOOK_SPEED));
      camera.quaternion.setFromEuler(new THREE.Euler(pitch.current, yaw.current, 0, "YXZ"));
    };

    const onContextMenu = (e: Event) => e.preventDefault();

    const onPointerDown = (e: PointerEvent) => {
      if (e.button === 0) dragMode.current = e.shiftKey ? "pan" : "orbit";
      else if (e.button === 1) dragMode.current = "pan";
      else if (e.button === 2) dragMode.current = "look";
      else return;

      el.setPointerCapture(e.pointerId);
      lastPointer.current = { x: e.clientX, y: e.clientY };
      if (dragMode.current === "orbit") {
        pivot.current.copy(camera.position).addScaledVector(forwardOf(camera), pivotDistance.current);
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      if (dragMode.current === "none") return;
      const dx = e.clientX - lastPointer.current.x;
      const dy = e.clientY - lastPointer.current.y;
      lastPointer.current = { x: e.clientX, y: e.clientY };

      if (dragMode.current === "look") {
        applyLook(dx, dy);
      } else if (dragMode.current === "orbit") {
        const radius = camera.position.distanceTo(pivot.current);
        applyLook(dx, dy);
        camera.position.copy(pivot.current).addScaledVector(forwardOf(camera), -radius);
      } else if (dragMode.current === "pan") {
        const scale = pivotDistance.current * PAN_SPEED;
        const move = rightOf(camera)
          .multiplyScalar(-dx * scale)
          .addScaledVector(upOf(camera), dy * scale);
        camera.position.add(move);
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      dragMode.current = "none";
      el.releasePointerCapture(e.pointerId);
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const amount = pivotDistance.current * DOLLY_STEP * Math.sign(e.deltaY);
      camera.position.addScaledVector(forwardOf(camera), amount);
      pivotDistance.current = Math.max(0.05, pivotDistance.current - amount);
    };

    const isTypingTarget = (target: EventTarget | null) =>
      target instanceof HTMLElement && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT");

    const onKeyDown = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return;
      keys.current.add(e.key.toLowerCase());
    };
    const onKeyUp = (e: KeyboardEvent) => keys.current.delete(e.key.toLowerCase());

    el.addEventListener("contextmenu", onContextMenu);
    el.addEventListener("pointerdown", onPointerDown);
    el.addEventListener("pointermove", onPointerMove);
    el.addEventListener("pointerup", onPointerUp);
    el.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      el.removeEventListener("contextmenu", onContextMenu);
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerup", onPointerUp);
      el.removeEventListener("wheel", onWheel);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      keys.current.clear();
      dragMode.current = "none";
    };
  }, [camera, enabled, gl]);

  useFrame((_, delta) => {
    if (!enabled || keys.current.size === 0) return;
    const speed = (keys.current.has("shift") ? FLY_SPEED_FAST : FLY_SPEED) * delta;
    const move = new THREE.Vector3();
    if (keys.current.has("w")) move.add(forwardOf(camera));
    if (keys.current.has("s")) move.sub(forwardOf(camera));
    if (keys.current.has("d")) move.add(rightOf(camera));
    if (keys.current.has("a")) move.sub(rightOf(camera));
    if (keys.current.has("e")) move.add(upOf(camera));
    if (keys.current.has("q")) move.sub(upOf(camera));
    if (move.lengthSq() > 0) camera.position.addScaledVector(move.normalize(), speed);
  });

  return { syncOrientation };
}
