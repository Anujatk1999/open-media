import { create, type StateCreator } from "zustand";
import * as THREE from "three";
import {
  clonePosture,
  describePostureError,
  readPosture,
  writePosture,
  type Posture,
} from "../modules/composer/helpers/posture";
import { groundFigure } from "../modules/composer/helpers/mannequinFactory";
import { sampleTrack } from "../modules/motion/helpers/sampleTrack";
import { yawPitchTowards, eulerFromYawPitch } from "../modules/motion/helpers/cameraFree";
import type { ShotParams } from "../modules/library/calibration/shotSolver";
import { sequenceDuration } from "../modules/motion/helpers/shotSequence";

export type ComposerTool = "select" | "move" | "rotate" | "scale" | "pose";

export type CharacterType =
  | "male"
  | "female"
  | "child";

export type PrimitiveType =
  | "cube"
  | "plane"
  | "cylinder"
  | "sphere"
  | "capsule"
  | "cone"
  | "torus";

/** A cinematic camera is a scene object like any other, always present in the one shared store — the Motion-mode UI is what gates its creation/rendering, not the data model. */
export type ObjectType = CharacterType | PrimitiveType | "camera";

export interface SceneTransform {
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
}

/**
 * A procedural camera behavior, evaluated fresh every frame from the current
 * (independently animated) state of its target(s) — the camera's own
 * keyframe track is untouched by any of these; position/rotation from a rig
 * simply wins for that frame. Only meaningful on `type: "camera"` objects.
 * All four are quaternion/vector math (Object3D.lookAt, circular parametric
 * motion) — none of them ever write an Euler rotation keyframe.
 */
export type CameraRig =
  | { type: "follow"; targetId: string; offset: [number, number, number] }
  | {
      type: "orbit";
      targetId: string;
      radius: number;
      height: number;
      startAngleDeg: number;
      endAngleDeg: number;
      duration: number;
      /** Global timeline time the sweep begins; holds at startAngleDeg before it and endAngleDeg after. */
      startTime: number;
    }
  | {
      type: "shot";
      targetId: string;
      /** The "other" character an "ots" angle looks past the target toward — ignored by every other angle. */
      secondaryTargetId?: string | null;
      shotParams: ShotParams;
    };

/**
 * One shot in the store's top-level `shotSequence` — a `shot`-style re-solved
 * framing, held for `duration` seconds. Deliberately plain data with no
 * camera/SceneObject attached: the sequence is evaluated every frame straight
 * off this array by one dedicated runtime cinematic camera (see
 * ComposerViewport's CinematicSequenceCamera), never a scene camera object,
 * so selecting/editing shots can never leave a persistent camera behind. A
 * segment's start time is deliberately not stored — it's always the
 * cumulative duration of the segments before it, so reordering/resizing can
 * never desync a start time from its neighbors.
 */
export interface ShotSegment {
  id: string;
  targetId: string;
  secondaryTargetId?: string | null;
  shotParams: ShotParams;
  duration: number;
}

export const DEFAULT_SHOT_SEGMENT_DURATION = 3;

export interface Keyframe {
  id: string;
  time: number;
  /**
   * For a camera, this IS the camera's full state (position + orientation) —
   * no separate rig/pivot field. sampleTrack.ts already lerps position and
   * slerps rotation (via quaternion) between keyframes, which is exactly
   * "free camera" interpolation: no orbit target, no lookAt().
   */
  transform: SceneTransform;
  posture?: Posture;
  /** Camera field of view in degrees. Only meaningful for `type: "camera"` objects. */
  fov?: number;
}

export interface SceneObject {
  id: string;
  name: string;
  type: ObjectType;
  visible: boolean;
  locked: boolean;
  transform: SceneTransform;
  posture?: Posture;
  defaultPosture?: Posture;
  /** Sorted by time; a fresh camera starts with none, everything else starts with one at time 0. */
  keyframes: Keyframe[];
  /**
   * Timestamp `transform`/`posture`/`fov` were last staged at via a live
   * gizmo/pose edit, distinct from any committed keyframe. Valid only while it
   * still matches `playback.elapsed` — scrubbing, playing, or selecting a
   * keyframe all silently invalidate it just by moving elapsed away, no
   * explicit reset needed. This is what lets a drag preview a pose without
   * touching `keyframes` until "+ Keyframe" commits it. Static's own edits
   * never move `playback.elapsed` away from 0, so this degrades to a plain
   * direct write there.
   */
  liveEditTime: number | null;
  /** Live-staged FOV, mirrors `transform`/`posture`'s live-edit staging. Only meaningful for `type: "camera"`. */
  fov?: number;
  /**
   * A procedural behavior that continuously recalculates this camera's
   * position/orientation from its target's current animated state, instead of
   * requiring a keyframe at every frame. Null/absent means free orientation
   * from its own keyframe track, same as before this existed. Only meaningful
   * for `type: "camera"`.
   */
  cameraRig?: CameraRig | null;
}

export interface PlaybackState {
  playing: boolean;
  elapsed: number;
  speed: number;
  duration: number;
}

export interface ComposerState {
  objects: SceneObject[];

  selectedObjectId: string | null;

  /** Selected keyframe on the selected object's track, for the timeline UI. Null when editing the object's live transform instead. */
  selectedKeyframeId: string | null;

  /**
   * Which camera object is the "viewing" camera — drives video export and the
   * active-camera badge. Independent of `selectedObjectId`: selecting a camera
   * edits its transform/keyframes, setting it active decides what gets rendered.
   * Null means "no camera object exists yet" or one hasn't been chosen.
   */
  activeCameraId: string | null;

  activeTool: ComposerTool;

  /** Mannequin joint key currently being edited, e.g. "l_elbow". Null when none. */
  selectedJointKey: string | null;

  /** Pose mode sub-mode: the gizmo scales the selected part's shape instead of rotating the joint. */
  partScaleMode: boolean;

  playback: PlaybackState;

  /**
   * The cinematic cut list: a run of shot combinations played back to back on
   * the shared timeline. Deliberately store-level, not attached to any camera
   * object — a dedicated runtime camera (never a SceneObject) re-solves the
   * active segment every frame, so building/editing a sequence never creates,
   * reuses, or otherwise touches a scene camera.
   */
  shotSequence: ShotSegment[];

  /**
   * Live mannequin-js figures / primitive roots by object id. For mannequins this
   * is the figure itself, not its wrapper group, so `.posture` and `.l_arm` work.
   */
  objectInstances: Map<string, THREE.Object3D>;

  addObject: (type: ObjectType) => void;

  duplicateSelectedObject: () => void;

  deleteSelectedObject: () => void;

  duplicateObject: (id: string) => void;

  deleteObject: (id: string) => void;

  /** Removes every object from the scene. A normal history-recorded edit, so Undo restores it. */
  clearScene: () => void;

  selectObject: (id: string) => void;

  clearSelection: () => void;

  /** Sets which camera object is the active/viewing camera. No-op if `id` isn't a camera. */
  setActiveCamera: (id: string | null) => void;

  /** Sets/clears a camera's procedural rig. No-op if `id` isn't a camera, or a referenced target/secondaryTarget doesn't exist. */
  setCameraRig: (id: string, rig: CameraRig | null) => void;

  /** Appends a new segment to the shot sequence. */
  addShotSegment: (segment: Omit<ShotSegment, "id" | "duration"> & { duration?: number }) => void;

  /** Removes a segment from the shot sequence. */
  removeShotSegment: (segmentId: string) => void;

  /** Patches a segment's fields (duration, targetId, shotParams, ...) in place. */
  updateShotSegment: (segmentId: string, patch: Partial<Omit<ShotSegment, "id">>) => void;

  /** Reorders the shot sequence to match `segmentIds`. No-op unless it's a permutation of the existing segment ids. */
  reorderShotSegments: (segmentIds: string[]) => void;

  renameObject: (id: string, name: string) => void;

  toggleObjectVisibility: (id: string) => void;

  toggleObjectLock: (id: string) => void;

  /** Writes into the keyframe at `playback.elapsed` (creating one via live-staging if none exists there yet) — degrades to a plain write when the object has no track (Static's usual case). */
  updateObjectTransform: (id: string, transform: Partial<SceneTransform>) => void;

  updateObjectPosture: (id: string, posture: Posture) => void;

  updateObjectDefaultPosture: (id: string, posture: Posture) => void;

  /** Live-stages a new FOV, mirroring updateObjectTransform's staging. Only meaningful for `type: "camera"`. */
  updateObjectFov: (id: string, fov: number) => void;

  setActiveTool: (tool: ComposerTool) => void;

  selectJoint: (key: string | null) => void;

  setPartScaleMode: (on: boolean) => void;

  addKeyframe: (objectId: string, time: number) => void;
  /** Commits the object's current staged live edit as a new keyframe, appended after the last one. */
  commitLiveKeyframe: (objectId: string) => void;
  /** Replaces an object's whole track with a motion preset's keyframes — a fresh starting sequence, not a splice. */
  applyMotionPreset: (objectId: string, keyframes: Keyframe[]) => void;
  deleteKeyframe: (objectId: string, keyframeId: string) => void;
  duplicateKeyframe: (objectId: string, keyframeId: string) => void;
  moveKeyframeTime: (objectId: string, keyframeId: string, newTime: number) => void;
  updateKeyframeTransform: (objectId: string, keyframeId: string, transform: Partial<SceneTransform>) => void;
  selectKeyframe: (id: string | null) => void;

  setPlaying: (playing: boolean) => void;
  setElapsed: (elapsed: number) => void;
  setSpeed: (speed: number) => void;
  setDuration: (duration: number) => void;

  registerObjectInstance: (id: string, object: THREE.Object3D) => void;

  unregisterObjectInstance: (id: string) => void;

  resetObjectTransform: (id: string) => void;

  resetObjectPose: (id: string) => void;

  groundObject: (id: string) => void;

  applyPosture: (id: string, posture: Posture) => void;

  /** Past scene snapshots, oldest first. Empty means nothing to undo. */
  history: SceneObject[][];

  /** Snapshots undone past, newest first. Cleared on any new edit. */
  future: SceneObject[][];

  undo: () => void;

  redo: () => void;

  /** Brackets a continuous edit (a gizmo drag) so it lands as one undo step. */
  beginHistoryGroup: () => void;

  endHistoryGroup: () => void;
}

/**
 * Scene history — in memory only, no persistence.
 *
 * A snapshot is just the previous `objects` array reference. Every mutator here
 * replaces it immutably, so the old reference is already a valid frozen scene and
 * costs nothing to retain: unchanged SceneObjects are shared between snapshots.
 * That is also why history needs no per-action instrumentation — the wrapped
 * `set` below records whenever `objects` changes identity, so anything that edits
 * the scene (transform, posture, add, delete, rename, visibility, lock, joint
 * edits, keyframes) is covered, including code added later.
 *
 * ponytail: `objects` is the whole history — camera, active tool, selection and
 * playback are deliberately not restored. Add a full command stack if undo ever
 * needs to cross those.
 */
const HISTORY_LIMIT = 50;
const KEYFRAME_EPSILON = 1 / 24; // one frame at 24fps

let suppressHistory = false;
let groupDepth = 0;
let groupRecorded = false;

function withoutHistory<T>(fn: () => T): T {
  suppressHistory = true;
  try {
    return fn();
  } finally {
    suppressHistory = false;
  }
}

const withHistory =
  (initializer: StateCreator<ComposerState>): StateCreator<ComposerState> =>
  (set, get, api) => {
    const recordingSet: typeof set = (partial, replace) => {
      const before = get().objects;
      (set as any)(partial, replace);
      if (get().objects === before || suppressHistory) return;

      // A drag records only its pre-drag scene, not every mouse move.
      if (groupDepth > 0) {
        if (groupRecorded) return;
        groupRecorded = true;
      }

      // Touches `history`/`future` alone, so this nested call records nothing itself.
      (set as any)({ history: [...get().history, before].slice(-HISTORY_LIMIT), future: [] });
    };

    return initializer(recordingSet, get, api);
  };

// Backward-compatible type aliases (can be removed after migration)
export type MannequinSceneObject = SceneObject;
export type MannequinTransform = SceneTransform;
/** Aliases so scene/motion library helpers can keep importing these names unchanged. */
export type MotionObject = SceneObject;
export type MotionObjectType = ObjectType;

const PRIMITIVE_TYPES: PrimitiveType[] = ["cube", "plane", "cylinder", "sphere", "capsule", "cone", "torus"];

function isPrimitiveType(type: ObjectType): type is PrimitiveType {
  return (PRIMITIVE_TYPES as ObjectType[]).includes(type);
}

/**
 * Pose editing exists only for mannequins — a primitive or camera has no
 * joints, so leaving Pose active on one shows no gizmo at all and every tool
 * looks dead. Every path that changes the selection or the tool routes
 * through this.
 */
function canPoseSelection(objects: SceneObject[], id: string | null): boolean {
  const target = objects.find((o) => o.id === id);
  return !!target && !isPrimitiveType(target.type) && target.type !== "camera";
}

/** True when the current selection supports pose editing. For UI enablement. */
export const selectCanPose = (s: ComposerState) =>
  canPoseSelection(s.objects, s.selectedObjectId);

/**
 * Shot Combination framing is generic bounding-box math (see shotSolver's
 * getCharacterAnchors) — it works for mannequins and primitives alike. Only a
 * camera object has no meaningful "frame this" behavior.
 */
function canComposeShotSelection(objects: SceneObject[], id: string | null): boolean {
  const target = objects.find((o) => o.id === id);
  return !!target && target.type !== "camera";
}

/** True when the current selection supports Shot Combination framing. For UI enablement. */
export const selectCanComposeShot = (s: ComposerState) =>
  canComposeShotSelection(s.objects, s.selectedObjectId);

function findNearKeyframeIndex(keyframes: Keyframe[], time: number): number {
  return keyframes.findIndex((k) => Math.abs(k.time - time) <= KEYFRAME_EPSILON);
}

/**
 * "If a user moves the object at a new time, automatically create a
 * keyframe." Overwrites a keyframe within one frame of `time`, or seeds a new
 * one from the currently sampled transform/posture at that time.
 */
function upsertKeyframe(
  keyframes: Keyframe[],
  time: number,
  patch: { transform?: Partial<SceneTransform>; posture?: Posture; fov?: number },
  fallback?: { transform: SceneTransform; posture?: Posture; fov?: number },
): Keyframe[] {
  const index = findNearKeyframeIndex(keyframes, time);
  if (index >= 0) {
    const existing = keyframes[index];
    const updated: Keyframe = {
      ...existing,
      transform: patch.transform ? { ...existing.transform, ...patch.transform } : existing.transform,
      posture: patch.posture ? clonePosture(patch.posture) : existing.posture,
      fov: patch.fov ?? existing.fov,
    };
    const next = [...keyframes];
    next[index] = updated;
    return next;
  }

  // An empty track (e.g. a camera before its first "+ Keyframe") has nothing
  // to sample — fall back to the object's own current live-staged fields.
  const sampled = keyframes.length > 0 ? sampleTrack(keyframes, time) : fallback!;
  const seeded: Keyframe = {
    id: crypto.randomUUID(),
    time,
    transform: patch.transform ? { ...sampled.transform, ...patch.transform } : sampled.transform,
    posture: patch.posture ? clonePosture(patch.posture) : sampled.posture,
    fov: patch.fov ?? sampled.fov,
  };
  return [...keyframes, seeded].sort((a, b) => a.time - b.time);
}

/**
 * The transform/posture/fov a live edit should build on top of: the still-valid
 * staged edit, or the sampled track. Exported so the viewport's camera-tracking
 * render loop can independently sample a track target's current position at
 * the same shared `elapsed`, without duplicating this same effective-live logic.
 */
export function stageBase(o: SceneObject, elapsed: number): { transform: SceneTransform; posture?: Posture; fov?: number } {
  const isLive = o.liveEditTime !== null && Math.abs(o.liveEditTime - elapsed) < 1e-6;
  // A track-less object (a fresh camera before its first "+ Keyframe", or any
  // Static object before it has ever moved off elapsed 0) has nothing to
  // sample beyond its own current fields.
  if (isLive || o.keyframes.length === 0) {
    return { transform: o.transform, posture: o.posture, fov: o.fov };
  }
  return sampleTrack(o.keyframes, elapsed);
}

/**
 * Drops a camera's rig entirely if its primary target was deleted (it can no
 * longer solve anything), or just clears the OTS secondary if only that one
 * was deleted — mirroring how OTS already degrades gracefully to a solo shot
 * when there's no second character.
 */
function scrubCameraRig(rig: CameraRig, deletedId: string): CameraRig | null {
  if (rig.targetId === deletedId) return null;
  if (rig.type === "shot" && rig.secondaryTargetId === deletedId) return { ...rig, secondaryTargetId: null };
  return rig;
}

/** Mirrors scrubCameraRig for the store-level shot sequence: drops any segment whose primary target was deleted, else just clears a matching OTS secondary. */
function scrubShotSequence(segments: ShotSegment[], deletedId: string): ShotSegment[] {
  return segments
    .filter((s) => s.targetId !== deletedId)
    .map((s) => (s.secondaryTargetId === deletedId ? { ...s, secondaryTargetId: null } : s));
}

/**
 * The one authoritative answer to "which manually-managed camera renders this
 * scene" — used by the viewport's video export/preview only when there's no
 * shot sequence to render instead (see the dedicated runtime cinematic camera
 * in ComposerViewport). Priority: the flagged active camera if it's still a
 * real camera, else the first camera in the scene, else null when there's no
 * camera at all.
 */
export function resolveRenderCamera(objects: SceneObject[], activeCameraId: string | null): SceneObject | null {
  const cameras = objects.filter((o) => o.type === "camera");
  if (cameras.length === 0) return null;
  const active = activeCameraId ? cameras.find((o) => o.id === activeCameraId) : undefined;
  return active ?? cameras[0];
}

function objectName(type: ObjectType, index: number): string {
  return `${type.charAt(0).toUpperCase()}${type.slice(1)} ${String(index).padStart(2, "0")}`;
}

function createInitialObject(): SceneObject {
  const transform: SceneTransform = { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] };
  return {
    id: crypto.randomUUID(),
    name: "Male 01",
    type: "male",
    visible: true,
    locked: false,
    transform,
    keyframes: [{ id: crypto.randomUUID(), time: 0, transform }],
    liveEditTime: null,
  };
}

const initialObjects = [createInitialObject()];
const initialSelectedId = initialObjects[0]?.id ?? null;

export const useComposerStore =
  create<ComposerState>(
    withHistory((set, get) => ({
      objects: initialObjects,

      history: [],
      future: [],

      selectedObjectId: initialSelectedId,
      selectedKeyframeId: null,
      activeCameraId: null,

      activeTool: "move",

      selectedJointKey: null,

      partScaleMode: false,

      playback: { playing: false, elapsed: 0, speed: 1, duration: 6 },

      shotSequence: [],

      objectInstances: new Map<string, THREE.Object3D>(),

      addObject: (type) => {
        const current = get().objects;
        const position: [number, number, number] = [current.length * 1.5, 0, 0];
        // A freshly placed camera looks at the origin by default (a sensible
        // starting frame), free to be dragged anywhere afterward — not a pivot
        // it stays bound to.
        const rotation: [number, number, number] = type === "camera"
          ? (() => {
              const { yaw, pitch } = yawPitchTowards(position, [0, 0, 0]);
              return eulerFromYawPitch(yaw, pitch);
            })()
          : [0, 0, 0];
        const transform: SceneTransform = { position, rotation, scale: [1, 1, 1] };
        const fov = type === "camera" ? 10 : undefined;
        const object: SceneObject = {
          id: crypto.randomUUID(),
          name: objectName(type, current.length + 1),
          type,
          visible: true,
          locked: false,
          transform,
          fov,
          // Cameras start with no keyframe at all — one is only recorded when
          // the user explicitly clicks "+ Keyframe" for the first time.
          keyframes: type === "camera" ? [] : [{ id: crypto.randomUUID(), time: 0, transform }],
          liveEditTime: null,
        };

        set({
          objects: [...current, object],
          selectedObjectId: object.id,
          selectedKeyframeId: null,
          // A new object must be editable the moment it lands. Move is the tool
          // that applies to both mannequins and primitives, and it is never left
          // in Pose, which a primitive/camera cannot use.
          activeTool: "move",
          selectedJointKey: null,
          partScaleMode: false,
          // The first camera in a scene becomes the viewing camera automatically —
          // otherwise export/preview would have no camera to render through until
          // the user thinks to set one explicitly.
          activeCameraId: type === "camera" && get().activeCameraId === null ? object.id : get().activeCameraId,
        });
      },

      duplicateSelectedObject: () => {
        const { selectedObjectId } = get();
        if (!selectedObjectId) return;
        get().duplicateObject(selectedObjectId);
      },

      deleteSelectedObject: () => {
        const { selectedObjectId } = get();
        if (!selectedObjectId) return;
        get().deleteObject(selectedObjectId);
      },

      duplicateObject: (id) => {
        const { objects } = get();
        const source = objects.find((o) => o.id === id);
        if (!source) return;

        // Clone the object's CURRENT effective state (whatever is actually on
        // screen right now — a live gizmo edit or a sampled keyframe), not the
        // raw `.transform`/`.posture` fields, which are stale whenever the
        // object has committed keyframes. Cloning those stale fields as-is
        // used to (a) reset a scaled primitive back to its keyframed default
        // dimensions, and (b) place a duplicated mannequin exactly on top of
        // the original at its stale spawn position, making it look like the
        // duplicate never appeared.
        const time = get().playback.elapsed;
        const base = stageBase(source, time);

        const duplicate: SceneObject = {
          ...source,
          id: crypto.randomUUID(),
          name: `${source.name} Copy`,
          transform: {
            position: [
              base.transform.position[0] + 1,
              base.transform.position[1],
              base.transform.position[2],
            ],
            rotation: [...base.transform.rotation] as [number, number, number],
            scale: [...base.transform.scale] as [number, number, number],
          },
          fov: base.fov,
          keyframes: source.keyframes.map((k) => ({
            ...k,
            id: crypto.randomUUID(),
            transform: {
              position: [...k.transform.position] as [number, number, number],
              rotation: [...k.transform.rotation] as [number, number, number],
              scale: [...k.transform.scale] as [number, number, number],
            },
            posture: k.posture ? clonePosture(k.posture) : undefined,
          })),
          posture: base.posture ? clonePosture(base.posture) : undefined,
          defaultPosture: source.defaultPosture
            ? { ...source.defaultPosture, data: source.defaultPosture.data.map((arr) => [...arr]) }
            : undefined,
          // Matches `time`, so the duplicate reads as "live" immediately and
          // renders from the fields set above instead of its (stale) cloned
          // keyframe track — see `stageBase`/`AnimatedObject`'s `effectiveLive`.
          liveEditTime: time,
        };

        set({
          objects: [...objects, duplicate],
          selectedObjectId: duplicate.id,
          selectedKeyframeId: null,
        });
      },

      deleteObject: (id) => {
        const { objects, selectedObjectId, activeTool, selectedKeyframeId, shotSequence } = get();
        const remaining = objects
          .filter((o) => o.id !== id)
          .map((o) => (o.cameraRig ? { ...o, cameraRig: scrubCameraRig(o.cameraRig, id) } : o));
        const nextSelected =
          selectedObjectId === id
            ? remaining.length > 0
              ? remaining[0].id
              : null
            : selectedObjectId;

        // Deleting the last mannequin can drop the selection onto a primitive
        // or camera, which cannot stay in Pose without leaving every tool dead.
        const poseStillValid =
          activeTool !== "pose" || canPoseSelection(remaining, nextSelected);

        set({
          objects: remaining,
          selectedObjectId: nextSelected,
          selectedKeyframeId: selectedObjectId === id ? null : selectedKeyframeId,
          activeTool: poseStillValid ? activeTool : "move",
          selectedJointKey: poseStillValid ? get().selectedJointKey : null,
          partScaleMode: poseStillValid ? get().partScaleMode : false,
          activeCameraId: get().activeCameraId === id ? null : get().activeCameraId,
          shotSequence: scrubShotSequence(shotSequence, id),
        });
      },

      clearScene: () => {
        set({
          objects: [],
          selectedObjectId: null,
          selectedKeyframeId: null,
          selectedJointKey: null,
          partScaleMode: false,
          activeTool: "move",
          activeCameraId: null,
          shotSequence: [],
          playback: { ...get().playback, playing: false, elapsed: 0 },
        });
      },

      selectObject: (id) => {
        const { selectedObjectId, selectedKeyframeId, objects, activeTool } = get();
        // No early-return-and-done when re-clicking the same object: that click
        // is also how a user backs out of editing a selected keyframe and
        // returns to editing the object's live transform.
        if (selectedObjectId === id && selectedKeyframeId === null) return;
        // Clicking a primitive/camera while in Pose falls back to Move, so the
        // click leaves a working gizmo instead of none.
        if (activeTool === "pose" && !canPoseSelection(objects, id)) {
          set({
            selectedObjectId: id,
            selectedJointKey: null,
            selectedKeyframeId: null,
            activeTool: "move",
            partScaleMode: false,
          });
          return;
        }
        set({ selectedObjectId: id, selectedJointKey: null, selectedKeyframeId: null });
      },

      clearSelection: () => {
        set({ selectedObjectId: null, selectedJointKey: null, selectedKeyframeId: null });
      },

      setActiveCamera: (id) => {
        if (id !== null && !get().objects.some((o) => o.id === id && o.type === "camera")) return;
        set({ activeCameraId: id });
      },

      setCameraRig: (id, rig) => {
        const { objects } = get();
        const camera = objects.find((o) => o.id === id);
        if (!camera || camera.type !== "camera") return;
        if (rig) {
          if (rig.targetId === id || !objects.some((o) => o.id === rig.targetId)) return;
          if (rig.type === "shot" && rig.secondaryTargetId && !objects.some((o) => o.id === rig.secondaryTargetId)) return;
        }
        set({ objects: objects.map((o) => (o.id === id ? { ...o, cameraRig: rig } : o)) });
      },

      addShotSegment: (segment) => {
        const newSegment: ShotSegment = { id: crypto.randomUUID(), duration: DEFAULT_SHOT_SEGMENT_DURATION, ...segment };
        const segments = [...get().shotSequence, newSegment];
        set({ shotSequence: segments });
        // A sequence is only ever the complete cut if the timeline is at
        // least as long as it — never shrinks a duration the user already
        // extended for other objects, only grows to cover what was just added.
        const total = sequenceDuration(segments);
        if (total > get().playback.duration) get().setDuration(total);
      },

      removeShotSegment: (segmentId) => {
        set({ shotSequence: get().shotSequence.filter((s) => s.id !== segmentId) });
      },

      updateShotSegment: (segmentId, patch) => {
        const segments = get().shotSequence.map((s) => (s.id === segmentId ? { ...s, ...patch } : s));
        set({ shotSequence: segments });
        const total = sequenceDuration(segments);
        if (total > get().playback.duration) get().setDuration(total);
      },

      reorderShotSegments: (segmentIds) => {
        const bySegId = new Map(get().shotSequence.map((s) => [s.id, s]));
        const reordered = segmentIds.map((id) => bySegId.get(id)).filter((s): s is ShotSegment => !!s);
        if (reordered.length !== get().shotSequence.length) return;
        set({ shotSequence: reordered });
      },

      renameObject: (id, name) => {
        set((state) => ({
          objects: state.objects.map((o) =>
            o.id === id ? { ...o, name } : o
          ),
        }));
      },

      toggleObjectVisibility: (id) => {
        set((state) => ({
          objects: state.objects.map((o) =>
            o.id === id ? { ...o, visible: !o.visible } : o
          ),
        }));
      },

      toggleObjectLock: (id) => {
        set((state) => ({
          objects: state.objects.map((o) =>
            o.id === id ? { ...o, locked: !o.locked } : o
          ),
        }));
      },

      updateObjectTransform: (id, transform) => {
        const time = get().playback.elapsed;
        set((state) => ({
          objects: state.objects.map((o) => {
            if (o.id !== id) return o;
            const base = stageBase(o, time);
            return { ...o, transform: { ...base.transform, ...transform }, posture: base.posture, fov: base.fov, liveEditTime: time };
          }),
        }));
      },

      updateObjectPosture: (id, posture) => {
        const error = describePostureError(posture);
        if (error) {
          console.error(`[composerStore] rejected posture for ${id}: ${error}`);
          return;
        }
        const time = get().playback.elapsed;
        set((state) => ({
          objects: state.objects.map((o) => {
            if (o.id !== id) return o;
            const base = stageBase(o, time);
            return { ...o, transform: base.transform, posture: clonePosture(posture), liveEditTime: time };
          }),
        }));
      },

      updateObjectDefaultPosture: (id, posture) => {
        const error = describePostureError(posture);
        if (error) {
          console.error(`[composerStore] rejected default posture for ${id}: ${error}`);
          return;
        }
        // Not an edit: this is the boot posture, captured when the figure finishes
        // loading. Recording it would arm Undo before the user has done anything.
        withoutHistory(() =>
          set((state) => ({
            objects: state.objects.map((o) =>
              o.id === id ? { ...o, defaultPosture: clonePosture(posture) } : o,
            ),
          })),
        );
      },

      updateObjectFov: (id, fov) => {
        const time = get().playback.elapsed;
        set((state) => ({
          objects: state.objects.map((o) => {
            if (o.id !== id) return o;
            const base = stageBase(o, time);
            return { ...o, transform: base.transform, posture: base.posture, fov, liveEditTime: time };
          }),
        }));
      },

      setActiveTool: (tool) => {
        // Pose on a primitive/camera is ignored outright, so the working tool
        // stays put rather than switching to one with no gizmo. Covers the P
        // shortcut and both toolbars in one place.
        if (tool === "pose" && !canPoseSelection(get().objects, get().selectedObjectId)) return;

        // Joint editing only exists inside pose mode; leaving it drops the joint
        // selection so the part gizmo cannot outlive the mode that created it.
        if (tool === "pose") set({ activeTool: tool });
        else set({ activeTool: tool, selectedJointKey: null, partScaleMode: false });
      },

      selectJoint: (key) => {
        set({ selectedJointKey: key });
      },

      setPartScaleMode: (on) => {
        set({ partScaleMode: on });
      },

      addKeyframe: (objectId, time) => {
        set((state) => ({
          objects: state.objects.map((o) => {
            if (o.id !== objectId) return o;
            // `time` (from a timeline double-click) is only where the keyframe lands.
            // What it captures is whatever is actually staged right now, at the
            // playhead (state.playback.elapsed) — a double-click's pixel-derived
            // `time` essentially never matches liveEditTime/elapsed exactly, so
            // checking liveness against `time` instead of the real elapsed would
            // almost always miss a just-made live edit and fall back to the stale track.
            const current = stageBase(o, state.playback.elapsed);
            return { ...o, keyframes: upsertKeyframe(o.keyframes, time, current, current) };
          }),
        }));
      },

      commitLiveKeyframe: (objectId) => {
        set((state) => {
          const target = state.objects.find((o) => o.id === objectId);
          if (!target) return state;
          const time = state.playback.elapsed;
          const base = stageBase(target, time);
          // The very first keyframe ever committed lands exactly where the user
          // is currently parked, rather than being pushed a second ahead.
          const newTime = target.keyframes.length
            ? Math.max(target.keyframes[target.keyframes.length - 1].time + 1, time)
            : time;
          const keyframe: Keyframe = {
            id: crypto.randomUUID(),
            time: newTime,
            transform: { ...base.transform },
            posture: base.posture ? clonePosture(base.posture) : undefined,
            fov: base.fov,
          };
          return {
            objects: state.objects.map((o) =>
              o.id === objectId
                ? { ...o, keyframes: [...o.keyframes, keyframe].sort((a, b) => a.time - b.time) }
                : o,
            ),
            selectedKeyframeId: null,
            playback: {
              ...state.playback,
              elapsed: newTime,
              playing: false,
              duration: Math.max(state.playback.duration, newTime),
            },
          };
        });
      },

      applyMotionPreset: (objectId, keyframes) => {
        if (keyframes.length === 0) return;
        const maxTime = keyframes[keyframes.length - 1].time;
        set((state) => ({
          objects: state.objects.map((o) =>
            o.id === objectId ? { ...o, keyframes, liveEditTime: null } : o,
          ),
          selectedKeyframeId: null,
          playback: { ...state.playback, elapsed: 0, playing: false, duration: Math.max(state.playback.duration, maxTime) },
        }));
      },

      deleteKeyframe: (objectId, keyframeId) => {
        set((state) => ({
          objects: state.objects.map((o) => {
            if (o.id !== objectId || o.keyframes.length <= 1) return o;
            return { ...o, keyframes: o.keyframes.filter((k) => k.id !== keyframeId) };
          }),
          selectedKeyframeId: state.selectedKeyframeId === keyframeId ? null : state.selectedKeyframeId,
        }));
      },

      duplicateKeyframe: (objectId, keyframeId) => {
        const { objects, playback } = get();
        const object = objects.find((o) => o.id === objectId);
        const source = object?.keyframes.find((k) => k.id === keyframeId);
        if (!object || !source) return;
        const duplicate: Keyframe = {
          ...source,
          id: crypto.randomUUID(),
          time: Math.min(source.time + 0.25, playback.duration),
          transform: {
            position: [...source.transform.position] as [number, number, number],
            rotation: [...source.transform.rotation] as [number, number, number],
            scale: [...source.transform.scale] as [number, number, number],
          },
          posture: source.posture ? clonePosture(source.posture) : undefined,
        };
        set({
          objects: objects.map((o) =>
            o.id === objectId ? { ...o, keyframes: [...o.keyframes, duplicate].sort((a, b) => a.time - b.time) } : o,
          ),
          selectedKeyframeId: duplicate.id,
        });
      },

      moveKeyframeTime: (objectId, keyframeId, newTime) => {
        const clamped = Math.max(0, newTime);
        set((state) => ({
          objects: state.objects.map((o) =>
            o.id !== objectId
              ? o
              : {
                  ...o,
                  keyframes: o.keyframes
                    .map((k) => (k.id === keyframeId ? { ...k, time: clamped } : k))
                    .sort((a, b) => a.time - b.time),
                },
          ),
        }));
      },

      updateKeyframeTransform: (objectId, keyframeId, transform) => {
        set((state) => ({
          objects: state.objects.map((o) => {
            if (o.id !== objectId) return o;
            return {
              ...o,
              keyframes: o.keyframes.map((k) =>
                k.id === keyframeId ? { ...k, transform: { ...k.transform, ...transform } } : k,
              ),
            };
          }),
        }));
      },

      selectKeyframe: (id) => {
        const object = get().objects.find((o) => o.id === get().selectedObjectId);
        const keyframe = object?.keyframes.find((k) => k.id === id);
        set((state) => ({
          selectedKeyframeId: id,
          playback: keyframe ? { ...state.playback, elapsed: keyframe.time, playing: false } : state.playback,
        }));
      },

      setPlaying: (playing) => set((state) => ({ playback: { ...state.playback, playing } })),
      setElapsed: (elapsed) => set((state) => ({ playback: { ...state.playback, elapsed } })),
      setSpeed: (speed) => set((state) => ({ playback: { ...state.playback, speed } })),
      setDuration: (duration) =>
        set((state) => ({
          playback: { ...state.playback, duration, elapsed: Math.min(state.playback.elapsed, duration) },
        })),

      registerObjectInstance: (id: string, object: THREE.Object3D) => {
        set((state) => {
          state.objectInstances.set(id, object);
          return state;
        });
      },

      unregisterObjectInstance: (id: string) => {
        set((state) => {
          state.objectInstances.delete(id);
          return state;
        });
      },

      resetObjectTransform: (id: string) => {
        get().updateObjectTransform(id, { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] });
      },

      /**
       * Restores the posture captured when the figure was built. That boot posture
       * is not all zeros — Male/Female/Child each add their own offsets on top of
       * Mannequin's default — so zeroing joints would not be a reset.
       */
      resetObjectPose: (id: string) => {
        const figure = get().objectInstances.get(id) as any;
        const stored = get().objects.find((o) => o.id === id)?.defaultPosture;
        if (!figure || !stored) return;

        writePosture(figure, stored);
        groundFigure(figure);
        get().updateObjectPosture(id, readPosture(figure));
      },

      /** Re-plants the feet on the ground plane. Never stored — see helpers/posture.ts. */
      groundObject: (id: string) => {
        const figure = get().objectInstances.get(id);
        if (figure) groundFigure(figure);
      },

      /** Applies a library posture to the figure, then grounds it. */
      applyPosture: (id, posture) => {
        const figure = get().objectInstances.get(id) as any;
        get().updateObjectPosture(id, posture);
        if (!figure) return;
        writePosture(figure, posture);
        groundFigure(figure);
      },

      undo: () => {
        const { history, selectedObjectId, selectedJointKey, objects } = get();
        if (history.length === 0) return;

        const previous = history[history.length - 1];
        // The restored scene may predate the selected object, or postdate its
        // deletion; either way the selection has to land on something real.
        const selectionSurvives = previous.some((o) => o.id === selectedObjectId);

        withoutHistory(() =>
          set({
            objects: previous,
            history: history.slice(0, -1),
            future: [objects, ...get().future].slice(0, HISTORY_LIMIT),
            selectedObjectId: selectionSurvives
              ? selectedObjectId
              : previous[0]?.id ?? null,
            selectedJointKey: selectionSurvives ? selectedJointKey : null,
          }),
        );
      },

      redo: () => {
        const { future, selectedObjectId, selectedJointKey, objects, history } = get();
        if (future.length === 0) return;
        const next = future[0];
        const selectionSurvives = next.some((o) => o.id === selectedObjectId);
        withoutHistory(() =>
          set({
            objects: next,
            future: future.slice(1),
            history: [...history, objects].slice(-HISTORY_LIMIT),
            selectedObjectId: selectionSurvives ? selectedObjectId : next[0]?.id ?? null,
            selectedJointKey: selectionSurvives ? selectedJointKey : null,
          }),
        );
      },

      beginHistoryGroup: () => {
        groupDepth += 1;
        groupRecorded = false;
      },

      endHistoryGroup: () => {
        groupDepth = Math.max(0, groupDepth - 1);
      },
    })),
  );
