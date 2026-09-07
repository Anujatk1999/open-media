/**
 * Every command the MCP server can invoke, mapped 1:1 onto real
 * composerStore actions and existing library helpers. No command here
 * invents a capability the app doesn't already have — see mcp/README.md
 * and SKILL.md for the reasoning.
 */
import { useComposerStore, type SceneObject, type CameraRig, type ShotSegment } from '../../stores/composerStore';
import { describePostureError, type Posture } from '../composer/helpers/posture';
import { loadPoseLibrary, saveCustomPose } from '../composer/helpers/poseLibrary';
import { loadMotionLibrary, saveMotionToLibrary, isMotionCompatible } from '../motion/helpers/motionLibrary';
import { saveSceneToLibrary } from '../motion/helpers/sceneLibrary';
import { getAllLibraryEntries, getPoseLibraryEntries } from '../library/model';
import { SHOT_SIZE_OPTIONS, ANGLE_OPTIONS, ELEVATION_OPTIONS } from '../library/calibration/shotAxes';
import { COMPOSITION_PRESETS, getCompositionPreset } from '../library/calibration/compositionPresets';
import type { ShotParams } from '../library/calibration/shotSolver';
import { sequenceDuration, shotSegmentStart } from '../motion/helpers/shotSequence';
import { getShotAPI, getViewportAPI } from './registry';

class CommandError extends Error {}

function fail(message: string): never {
  throw new CommandError(message);
}

function requireShotAPI() {
  const api = getShotAPI();
  if (!api) fail('Shot controls are not ready yet — the Shot Composer tab may still be loading.');
  return api!;
}

function requireViewportAPI() {
  const api = getViewportAPI();
  if (!api) fail('The 3D viewport is not ready yet — the Shot Composer tab may still be loading.');
  return api!;
}

function requireObject(id: string): SceneObject {
  const object = useComposerStore.getState().objects.find((o) => o.id === id);
  if (!object) fail(`No object with id "${id}" in the current scene.`);
  return object!;
}

/** The store's top-level shot sequence, with each segment's derived start time — never stored, always recomputed from prior segments' durations. Never tied to any camera object. */
function summarizeShotSequence() {
  const segments = useComposerStore.getState().shotSequence;
  return {
    segments: segments.map((s, i) => ({
      id: s.id,
      targetId: s.targetId,
      secondaryTargetId: s.secondaryTargetId ?? null,
      shotParams: s.shotParams,
      duration: s.duration,
      startTime: shotSegmentStart(segments, i),
    })),
    totalDuration: sequenceDuration(segments),
  };
}

/** The subset of an object worth sending back over the wire — omits nothing an agent would need, but never serializes a live three.js instance. */
function summarizeObject(o: SceneObject) {
  return {
    id: o.id,
    name: o.name,
    type: o.type,
    visible: o.visible,
    locked: o.locked,
    transform: o.transform,
    fov: o.fov,
    cameraRig: o.cameraRig ?? null,
    posture: o.posture ?? null,
    hasDefaultPosture: Boolean(o.defaultPosture),
    keyframes: o.keyframes.map((k) => ({ id: k.id, time: k.time, transform: k.transform, fov: k.fov, hasPosture: Boolean(k.posture) })),
  };
}

export const commands: Record<string, (params: any) => unknown | Promise<unknown>> = {
  // ---- Scene / shot inspection ----
  get_scene: () => {
    const s = useComposerStore.getState();
    return {
      objects: s.objects.map(summarizeObject),
      selectedObjectId: s.selectedObjectId,
      selectedKeyframeId: s.selectedKeyframeId,
      activeCameraId: s.activeCameraId,
      activeTool: s.activeTool,
      playback: s.playback,
    };
  },

  get_shot: () => {
    const shotAPI = getShotAPI();
    return {
      shotParams: shotAPI?.getShotParams() ?? null,
      mode: shotAPI?.getMode() ?? null,
    };
  },

  list_shot_presets: () => ({
    shotSize: SHOT_SIZE_OPTIONS.map(([id, label]) => ({ id, label })),
    angle: ANGLE_OPTIONS.map(([id, label]) => ({ id, label })),
    elevation: ELEVATION_OPTIONS.map(([id, label]) => ({ id, label })),
    composition: COMPOSITION_PRESETS.map((p) => ({ id: p.id, label: p.label })),
  }),

  // ---- Objects ----
  add_object: ({ type }: { type: SceneObject['type'] }) => {
    useComposerStore.getState().addObject(type);
    return { id: useComposerStore.getState().selectedObjectId };
  },

  duplicate_object: ({ id }: { id?: string }) => {
    if (id) useComposerStore.getState().duplicateObject(id);
    else useComposerStore.getState().duplicateSelectedObject();
    return { id: useComposerStore.getState().selectedObjectId };
  },

  delete_object: ({ id }: { id?: string }) => {
    if (id) useComposerStore.getState().deleteObject(id);
    else useComposerStore.getState().deleteSelectedObject();
    return { ok: true };
  },

  select_object: ({ id }: { id: string }) => {
    requireObject(id);
    useComposerStore.getState().selectObject(id);
    return { ok: true };
  },

  rename_object: ({ id, name }: { id: string; name: string }) => {
    requireObject(id);
    useComposerStore.getState().renameObject(id, name);
    return { ok: true };
  },

  toggle_visibility: ({ id }: { id: string }) => {
    requireObject(id);
    useComposerStore.getState().toggleObjectVisibility(id);
    return { visible: requireObject(id).visible };
  },

  toggle_lock: ({ id }: { id: string }) => {
    requireObject(id);
    useComposerStore.getState().toggleObjectLock(id);
    return { locked: requireObject(id).locked };
  },

  set_transform: ({ id, transform }: { id: string; transform: Partial<SceneObject['transform']> }) => {
    requireObject(id);
    useComposerStore.getState().updateObjectTransform(id, transform);
    return summarizeObject(requireObject(id));
  },

  reset_transform: ({ id }: { id: string }) => {
    requireObject(id);
    useComposerStore.getState().resetObjectTransform(id);
    return summarizeObject(requireObject(id));
  },

  clear_scene: () => {
    useComposerStore.getState().clearScene();
    return { ok: true };
  },

  undo: () => {
    useComposerStore.getState().undo();
    return { ok: true };
  },

  redo: () => {
    useComposerStore.getState().redo();
    return { ok: true };
  },

  // ---- Pose ----
  list_poses: async () => {
    const poses = await loadPoseLibrary();
    return poses.map((p) => ({ id: p.id, name: p.name, category: p.category, source: p.source }));
  },

  apply_pose: async ({ id, poseId }: { id: string; poseId: string }) => {
    requireObject(id);
    const poses = await loadPoseLibrary();
    const pose = poses.find((p) => p.id === poseId);
    if (!pose) fail(`No pose with id "${poseId}". Call list_poses to see valid ids.`);
    useComposerStore.getState().applyPosture(id, pose!.posture);
    return summarizeObject(requireObject(id));
  },

  set_posture: ({ id, posture }: { id: string; posture: Posture }) => {
    requireObject(id);
    const error = describePostureError(posture);
    if (error) fail(`Invalid posture: ${error}`);
    useComposerStore.getState().updateObjectPosture(id, posture);
    return summarizeObject(requireObject(id));
  },

  reset_pose: ({ id }: { id: string }) => {
    requireObject(id);
    useComposerStore.getState().resetObjectPose(id);
    return summarizeObject(requireObject(id));
  },

  save_pose: ({ id, name }: { id: string; name: string }) => {
    const object = requireObject(id);
    const posture = object.posture ?? object.defaultPosture;
    if (!posture) fail(`Object "${id}" has no posture to save (not a posed character).`);
    return saveCustomPose(name, posture!);
  },

  // ---- Shot framing ----
  set_shot: ({ shotSize, angle, elevation, composition }: Partial<{ shotSize: string; angle: string; elevation: string; composition: string }>) => {
    const shotAPI = requireShotAPI();
    const current = shotAPI.getShotParams();
    const next: ShotParams = {
      shotSize: (shotSize as ShotParams['shotSize']) ?? current.shotSize,
      angle: (angle as ShotParams['angle']) ?? current.angle,
      elevation: (elevation as ShotParams['elevation']) ?? current.elevation,
      composition: composition ? getCompositionPreset(composition) : current.composition,
    };
    shotAPI.setShotParams(next);
    // The shot is re-solved and applied to the viewport camera by ComposerShell's
    // own effect (keyed on shotParams) a render after this returns — applying it
    // requires a posable character to be selected first in Static mode (see
    // select_object). Requires OTS's implicit second character to already be in
    // the scene when angle is "ots".
    return { shotParams: next };
  },

  set_mode: ({ mode }: { mode: 'static' | 'motion' }) => {
    requireShotAPI().setMode(mode);
    return { mode };
  },

  capture_shot: async ({ download }: { download?: boolean } = {}) => {
    const dataUrl = await requireViewportAPI().captureShot({ download: download ?? false });
    return { dataUrl };
  },

  // ---- Camera ----
  set_camera_fov: ({ id, fov }: { id: string; fov: number }) => {
    const object = requireObject(id);
    if (object.type !== 'camera') fail(`Object "${id}" is not a camera.`);
    useComposerStore.getState().updateObjectFov(id, fov);
    return summarizeObject(requireObject(id));
  },

  /** Multiple cameras can each have their own keyframe track; this decides which one export/preview actually renders through. */
  set_active_camera: ({ id }: { id: string }) => {
    const object = requireObject(id);
    if (object.type !== 'camera') fail(`Object "${id}" is not a camera.`);
    useComposerStore.getState().setActiveCamera(id);
    return { activeCameraId: useComposerStore.getState().activeCameraId };
  },

  /**
   * Sets or clears a camera's procedural rig — the foundation that lets an
   * agent express cinematic intent ("orbit 360 degrees around them",
   * "follow the runner") without generating a position/rotation keyframe for
   * every single frame. The camera's own keyframe track is left untouched
   * either way; a rig just recalculates its transform fresh every frame from
   * the target's current (also independently animated) state:
   *   - follow: hold a fixed world-space `offset` from `targetId`, always facing it.
   *   - orbit: circle `targetId` at `radius`/`height`, sweeping `startAngleDeg`
   *     to `endAngleDeg` over `duration` seconds starting at `startTime`
   *     (default 0) on the shared timeline; holds at the end angle after.
   *   - shot: continuously re-solve one of the existing shot presets (same
   *     shotSize/angle/elevation/composition as set_shot/list_shot_presets)
   *     against `targetId`'s live bounding box every frame, so the framing is
   *     maintained while the target moves. `secondaryTargetId` is the "other"
   *     character an "ots" angle looks past the target toward.
   * Pass `{ type: "none" }` to clear a rig and go back to free rotation from
   * the camera's own track.
   */
  set_camera_rig: ({ id, rig }: { id: string; rig: any }) => {
    const object = requireObject(id);
    if (object.type !== 'camera') fail(`Object "${id}" is not a camera.`);

    if (rig.type === 'none') {
      useComposerStore.getState().setCameraRig(id, null);
      return summarizeObject(requireObject(id));
    }

    requireObject(rig.targetId);
    let resolved: CameraRig;
    if (rig.type === 'shot') {
      if (rig.secondaryTargetId) requireObject(rig.secondaryTargetId);
      const shotParams: ShotParams = {
        shotSize: rig.shotSize,
        angle: rig.angle,
        elevation: rig.elevation,
        composition: getCompositionPreset(rig.composition),
      };
      resolved = { type: 'shot', targetId: rig.targetId, secondaryTargetId: rig.secondaryTargetId ?? null, shotParams };
    } else if (rig.type === 'orbit') {
      resolved = { ...rig, startTime: rig.startTime ?? 0 };
    } else {
      resolved = rig;
    }

    useComposerStore.getState().setCameraRig(id, resolved);
    return summarizeObject(requireObject(id));
  },

  /**
   * Appends one shot to the store's shot sequence — a run of re-solved shot
   * presets (see set_shot/list_shot_presets), each held for `duration`
   * seconds and re-solved live against its target's current bounding box, so
   * a wide->OTS->medium->close-up sequence keeps each framing correct even as
   * targets move. Rendered by one dedicated cinematic camera the app manages
   * internally — this never creates or touches any camera object.
   * `secondaryTargetId` is the "other" character an "ots" angle looks past
   * `targetId` toward.
   */
  add_shot_segment: ({ targetId, secondaryTargetId, shotSize, angle, elevation, composition, duration }: {
    targetId: string; secondaryTargetId?: string; shotSize: string; angle: string; elevation: string; composition: string; duration?: number;
  }) => {
    requireObject(targetId);
    if (secondaryTargetId) requireObject(secondaryTargetId);
    const shotParams: ShotParams = {
      shotSize: shotSize as ShotParams['shotSize'],
      angle: angle as ShotParams['angle'],
      elevation: elevation as ShotParams['elevation'],
      composition: getCompositionPreset(composition),
    };
    useComposerStore.getState().addShotSegment({
      targetId, secondaryTargetId: secondaryTargetId ?? null, shotParams,
      ...(duration !== undefined ? { duration } : {}),
    });
    return summarizeShotSequence();
  },

  /** Reads the shot sequence (each segment's derived start time included). */
  get_shot_sequence: () => summarizeShotSequence(),

  /** Patches one segment of the shot sequence — any field omitted keeps its current value. */
  update_shot_segment: ({ segmentId, targetId, secondaryTargetId, shotSize, angle, elevation, composition, duration }: {
    segmentId: string; targetId?: string; secondaryTargetId?: string | null; shotSize?: string; angle?: string; elevation?: string; composition?: string; duration?: number;
  }) => {
    const segment = useComposerStore.getState().shotSequence.find((s) => s.id === segmentId);
    if (!segment) fail(`No segment with id "${segmentId}" in the shot sequence.`);
    if (targetId) requireObject(targetId);
    if (secondaryTargetId) requireObject(secondaryTargetId);

    const patch: Partial<Omit<ShotSegment, 'id'>> = {};
    if (targetId) patch.targetId = targetId;
    if (secondaryTargetId !== undefined) patch.secondaryTargetId = secondaryTargetId;
    if (duration !== undefined) patch.duration = duration;
    if (shotSize || angle || elevation || composition) {
      patch.shotParams = {
        shotSize: (shotSize as ShotParams['shotSize']) ?? segment!.shotParams.shotSize,
        angle: (angle as ShotParams['angle']) ?? segment!.shotParams.angle,
        elevation: (elevation as ShotParams['elevation']) ?? segment!.shotParams.elevation,
        composition: composition ? getCompositionPreset(composition) : segment!.shotParams.composition,
      };
    }
    useComposerStore.getState().updateShotSegment(segmentId, patch);
    return summarizeShotSequence();
  },

  /** Removes one segment from the shot sequence. */
  remove_shot_segment: ({ segmentId }: { segmentId: string }) => {
    useComposerStore.getState().removeShotSegment(segmentId);
    return summarizeShotSequence();
  },

  /** Renders the Motion timeline through to a downloaded video file — the same recording the in-app Export Video button triggers, just invoked over MCP. Requires Motion mode and a camera already set active. */
  export_video: async () => {
    await requireViewportAPI().exportVideo();
    return { ok: true };
  },

  // ---- Keyframes / motion ----
  add_keyframe: ({ id, time }: { id: string; time: number }) => {
    requireObject(id);
    useComposerStore.getState().addKeyframe(id, time);
    return summarizeObject(requireObject(id));
  },

  update_keyframe: ({ id, keyframeId, transform }: { id: string; keyframeId: string; transform: Partial<SceneObject['transform']> }) => {
    requireObject(id);
    useComposerStore.getState().updateKeyframeTransform(id, keyframeId, transform);
    return summarizeObject(requireObject(id));
  },

  delete_keyframe: ({ id, keyframeId }: { id: string; keyframeId: string }) => {
    requireObject(id);
    useComposerStore.getState().deleteKeyframe(id, keyframeId);
    return summarizeObject(requireObject(id));
  },

  duplicate_keyframe: ({ id, keyframeId }: { id: string; keyframeId: string }) => {
    requireObject(id);
    useComposerStore.getState().duplicateKeyframe(id, keyframeId);
    return summarizeObject(requireObject(id));
  },

  move_keyframe_time: ({ id, keyframeId, time }: { id: string; keyframeId: string; time: number }) => {
    requireObject(id);
    useComposerStore.getState().moveKeyframeTime(id, keyframeId, time);
    return summarizeObject(requireObject(id));
  },

  list_motions: () => loadMotionLibrary().map((m) => ({ id: m.id, name: m.name, category: m.category, description: m.description, objectType: m.objectType, duration: m.duration })),

  apply_motion_preset: ({ id, motionId }: { id: string; motionId: string }) => {
    const object = requireObject(id);
    const asset = loadMotionLibrary().find((m) => m.id === motionId);
    if (!asset) fail(`No motion with id "${motionId}". Call list_motions to see valid ids.`);
    if (!isMotionCompatible(asset!.objectType, object.type)) fail(`Motion "${motionId}" (${asset!.objectType}) is not compatible with object "${id}" (${object.type}).`);
    useComposerStore.getState().applyMotionPreset(id, asset!.keyframes.map((k) => ({ ...k, id: crypto.randomUUID() })));
    return summarizeObject(requireObject(id));
  },

  save_motion: ({ id, name, category, description }: { id: string; name: string; category?: string; description?: string }) => {
    const object = requireObject(id);
    if (object.keyframes.length < 2) fail(`Object "${id}" needs at least two keyframes before its motion can be saved.`);
    const duration = useComposerStore.getState().playback.duration;
    return saveMotionToLibrary(name, category ?? '', description ?? '', object, duration);
  },

  set_duration: ({ duration }: { duration: number }) => {
    useComposerStore.getState().setDuration(duration);
    return { duration };
  },

  set_playback: ({ playing, elapsed, speed }: Partial<{ playing: boolean; elapsed: number; speed: number }>) => {
    const store = useComposerStore.getState();
    if (playing !== undefined) store.setPlaying(playing);
    if (elapsed !== undefined) store.setElapsed(elapsed);
    if (speed !== undefined) store.setSpeed(speed);
    return useComposerStore.getState().playback;
  },

  // ---- Save / library ----
  save_scene: ({ name }: { name: string }) => {
    const s = useComposerStore.getState();
    if (s.objects.length === 0) fail('The scene is empty — add something before saving it.');
    const shotParams = getShotAPI()?.getShotParams();
    if (!shotParams) fail('Shot controls are not ready yet.');
    return saveSceneToLibrary(name, s.objects, s.playback.duration, shotParams!, s.activeCameraId);
  },

  list_library: async () => {
    const [poses] = await Promise.all([getPoseLibraryEntries()]);
    return [...getAllLibraryEntries(), ...poses];
  },
};

export type CommandName = keyof typeof commands;

export async function runCommand(name: string, params: unknown): Promise<{ ok: true; result: unknown } | { ok: false; error: string }> {
  const handler = commands[name];
  if (!handler) return { ok: false, error: `Unknown command "${name}".` };
  try {
    const result = await handler(params ?? {});
    return { ok: true, result };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
