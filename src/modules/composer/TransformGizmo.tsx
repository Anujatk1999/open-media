import { useEffect, useRef } from "react";
import { TransformControls } from "@react-three/drei";
import type { TransformControls as TransformControlsType } from "three-stdlib";
import * as THREE from "three";
import { useThree } from "@react-three/fiber";

export interface GizmoTransform {
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
}

interface TransformGizmoProps {
  target: THREE.Object3D | null;
  activeTool: "move" | "rotate" | "scale" | "pose" | "select";
  locked: boolean;
  /** Only used to key the re-attach effect, mirrors the old `selected?.transform.*` deps. */
  transform: GizmoTransform | null;
  onChange: (transform: GizmoTransform) => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
}

export default function TransformGizmo({ target, activeTool, locked, transform, onChange, onDragStart, onDragEnd }: TransformGizmoProps) {
  const controlsRef = useRef<TransformControlsType>(null);
  const { camera } = useThree();

  /**
   * The store's tool is the only source of truth for which gizmo is showing.
   *
   * This used to be pushed imperatively with `setMode` from an effect keyed on
   * `[activeTool, controlsRef.current]`, which desynced whenever the controls
   * mounted rather than the tool changed: a ref reads as its *pre-commit* value
   * during render, so on the render that first shows the gizmo the dep was still
   * `null` — unchanged — and the effect never ran. The gizmo therefore came up in
   * its constructor default (translate) every time it mounted under an already
   * active Rotate or Scale, i.e. on selecting an object, unlocking one, or
   * leaving pose mode. Passing `mode` as a prop lets R3F apply it on mount and on
   * every change, and `mode` is a defined property on TransformControls whose
   * setter swaps the handle set — so the previous mode's gizmo is always torn
   * down before the new one attaches.
   */
  const mode = activeTool === "rotate" ? "rotate" : activeTool === "scale" ? "scale" : "translate";

  // Track drag state explicitly — don't rely on controls.enabled timing.
  const isDraggingRef = useRef(false);
  const pendingUpdate = useRef<GizmoTransform | null>(null);

  // `onChange` is an inline closure in every caller (it captures the selected
  // id), so it gets a new identity on every parent render — and every drag
  // tick itself triggers a parent re-render via the store update `onChange`
  // just made. If those callbacks were in this effect's deps, that re-render
  // would tear the effect down mid-drag: the "unmount mid-drag" cleanup below
  // would then fire on every single pointermove, permanently resetting
  // `orbit.enabled = true` after the very first tick — camera orbit fighting
  // the drag for the rest of the gesture, indistinguishable from the gizmo
  // "not working". Refs let the effect read the latest callback without
  // depending on its identity, so it attaches once per target and stays put
  // for the whole drag.
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const onDragStartRef = useRef(onDragStart);
  onDragStartRef.current = onDragStart;
  const onDragEndRef = useRef(onDragEnd);
  onDragEndRef.current = onDragEnd;

  useEffect(() => {
    const ctrl = controlsRef.current;
    if (!ctrl) return;

    const onStart = () => {
      isDraggingRef.current = true;
      pendingUpdate.current = null;
      const orbit = (camera as any)?.__orbitControls;
      if (orbit) orbit.enabled = false;
      onDragStartRef.current?.();
    };

    const onStop = () => {
      isDraggingRef.current = false;
      if (pendingUpdate.current) {
        onChangeRef.current(pendingUpdate.current);
        pendingUpdate.current = null;
      }
      const orbit = (camera as any)?.__orbitControls;
      if (orbit) orbit.enabled = true;
      onDragEndRef.current?.();
    };

    // Accumulate live changes for Inspector feedback during drag.
    const onChangeHandle = () => {
      if (!target) return;
      const pos = target.position;
      const rot = target.rotation;
      const scl = target.scale;
      const snapshot: GizmoTransform = {
        position: [pos.x, pos.y, pos.z],
        rotation: [rot.x, rot.y, rot.z],
        scale: [scl.x, scl.y, scl.z],
      };
      pendingUpdate.current = snapshot;
      onChangeRef.current(snapshot);
    };

    (ctrl as any).addEventListener("mouseDown", onStart);
    (ctrl as any).addEventListener("mouseUp", onStop);
    (ctrl as any).addEventListener("objectChange", onChangeHandle);

    return () => {
      (ctrl as any).removeEventListener("mouseDown", onStart);
      (ctrl as any).removeEventListener("mouseUp", onStop);
      (ctrl as any).removeEventListener("objectChange", onChangeHandle);
      // Unmounting mid-drag (a tool switch, say) skips mouseUp, which would
      // otherwise leave the history group open and swallow every later edit —
      // and leave OrbitControls disabled, killing orbit and pan for good, since
      // nothing else ever writes `enabled` back: it is not a prop drei manages,
      // so no re-render restores it.
      if (isDraggingRef.current) {
        isDraggingRef.current = false;
        onDragEndRef.current?.();
        const orbit = (camera as any)?.__orbitControls;
        if (orbit) orbit.enabled = true;
      }
    };
    // Same mount-timing gap as the layer effect below: this must re-run
    // whenever the render-gate at the bottom flips, not just when target or
    // camera change, or a mount triggered purely by activeTool/locked leaves
    // the listeners bound to nothing — dragging succeeds internally (grabs an
    // axis) but orbit never disables and objectChange never reaches the store.
  }, [target, camera, activeTool, locked]);

  // When store changes from Inspector, re-attach TransformControls so it
  // picks up the new position. Only re-attach when NOT dragging.
  useEffect(() => {
    if (isDraggingRef.current) return;
    const ctrl = controlsRef.current;
    if (!ctrl || !target || locked) return;
    if ((ctrl as any).object === target) {
      ctrl.detach();
      ctrl.attach(target);
    }
  }, [transform?.position, transform?.rotation, transform?.scale, target, locked]);

  // Layer 1 keeps the gizmo's arrows/rings/planes out of the Shot Preview's
  // camera, which only ever sees the default layer 0 — same scheme the
  // grid/axes already use in ComposerViewport. TransformControls IS the
  // Object3D added to the scene (three-stdlib's class extends Object3D), so
  // traversing the ref reaches every handle mesh — including the invisible
  // picker/plane hitboxes the control drags against, not just the visible
  // ones. Its own internal `raycaster` (a plain `new Raycaster()`, one per
  // instance) defaults to layer 0 only, so without also enabling layer 1
  // there it can no longer see any of those meshes — the gizmo would still
  // render (the main camera sees both layers) but stop responding to clicks
  // or drags entirely.
  // Deps must cover everything the render-gate below checks, not just
  // `target`/`mode`: the gizmo mounts (ref attaches) whenever that gate flips
  // from hidden to shown, which can happen via `activeTool`/`locked` alone
  // (e.g. Motion resolves `target` while still in "select", then flips to
  // "move" with target/mode unchanged) — without those two in the deps this
  // effect silently skips the mount and the fresh instance's layers/raycaster
  // are left on the constructor default, permanently.
  useEffect(() => {
    const ctrl = controlsRef.current;
    if (!ctrl) return;
    ctrl.traverse((o) => o.layers.set(1));
    (ctrl as any).raycaster?.layers.enable(1);
  }, [target, mode, activeTool, locked]);

  // Don't show TransformGizmo in Pose mode — pose editing is independent.
  // "select" is the Motion editor's own tool with no gizmo at all.
  if (activeTool === "pose" || activeTool === "select" || !target || locked) return null;

  return (
    <TransformControls
      ref={controlsRef}
      object={target}
      mode={mode}
      space="world"
      size={1.0}
    />
  );
}
