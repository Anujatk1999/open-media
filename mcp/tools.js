import { z } from 'zod';

// Keep these enums in sync with:
//   src/modules/library/calibration/shotAxes.ts (shotSize/angle/elevation)
//   src/modules/library/calibration/compositionPresets.ts (composition)
// Two separate processes/toolchains (this Node server vs. the Vite app), so
// there is no shared import — call list_shot_presets at runtime if these ever
// drift, it reads the live source of truth.
const SHOT_SIZE = z.enum(['wide', 'full', 'medium', 'mcu', 'closeup']);
const CAMERA_ANGLE = z.enum(['front', 'threeQuarterLeft', 'threeQuarterRight', 'profile', 'back', 'ots']);
const ELEVATION = z.enum(['eye', 'low', 'high']);
const COMPOSITION = z.enum(['center', 'leftThird', 'rightThird', 'upperThird', 'lowerThird', 'negativeSpace']);
const OBJECT_TYPE = z.enum(['male', 'female', 'child', 'cube', 'plane', 'cylinder', 'sphere', 'capsule', 'cone', 'torus', 'camera']);

const VEC3 = z.tuple([z.number(), z.number(), z.number()]);
const TRANSFORM = z.object({
  position: VEC3.optional(),
  rotation: VEC3.optional(),
  scale: VEC3.optional(),
}).describe('Partial transform — omit any field to leave it unchanged. Position/scale are world units, rotation is Euler radians [x,y,z].');

/**
 * One entry per browser-side command (src/modules/mcpBridge/commands.ts).
 * `name`/`description` become the MCP tool; `inputSchema` is a raw Zod shape
 * (not wrapped in z.object) per @modelcontextprotocol/sdk's registerTool.
 */
export const TOOLS = [
  {
    name: 'get_scene',
    description: 'Get every object in the current scene (id, name, type, transform, visibility, lock, posture presence, keyframes, fov, cameraRig) plus selection/playback state and which camera (if any) is the active/viewing camera. Call this first to see what exists before changing anything. Each object carries its own independent keyframe track on the same shared timeline, so a character and a camera (or several cameras) can be keyframed and played back concurrently without affecting each other; a camera\'s cameraRig (see set_camera_rig) additionally overrides its position/orientation each frame to procedurally track/follow/orbit a target or maintain a shot preset.',
    inputSchema: {},
  },
  {
    name: 'get_shot',
    description: 'Get the current shot framing (shot size, camera angle, elevation, composition) and editor mode (static/motion).',
    inputSchema: {},
  },
  {
    name: 'list_shot_presets',
    description: 'List every valid id for shot size, camera angle, elevation, and composition, with human-readable labels.',
    inputSchema: {},
  },
  {
    name: 'add_object',
    description: 'Add a character (male/female/child), primitive (cube/plane/cylinder/sphere/capsule/cone/torus), or camera to the scene. The new object becomes selected. A camera can be added and framed in either Static or Motion mode; only Motion mode plays back its keyframes.',
    inputSchema: { type: OBJECT_TYPE },
  },
  {
    name: 'duplicate_object',
    description: 'Duplicate an object (its current position/pose, not stale keyframed defaults). Omit id to duplicate the currently selected object.',
    inputSchema: { id: z.string().optional() },
  },
  {
    name: 'delete_object',
    description: 'Delete an object from the scene. Omit id to delete the currently selected object.',
    inputSchema: { id: z.string().optional() },
  },
  {
    name: 'select_object',
    description: 'Select an object by id. Required before set_shot in Static mode (the shot solves relative to the selected object — any type except camera), and before Pose/keyframe tools that act on "the selection" implicitly.',
    inputSchema: { id: z.string() },
  },
  {
    name: 'rename_object',
    description: 'Rename an object in the Scene panel.',
    inputSchema: { id: z.string(), name: z.string() },
  },
  {
    name: 'toggle_visibility',
    description: 'Toggle an object\'s visibility. Returns the resulting state.',
    inputSchema: { id: z.string() },
  },
  {
    name: 'toggle_lock',
    description: 'Toggle whether an object is locked against transform edits. Returns the resulting state.',
    inputSchema: { id: z.string() },
  },
  {
    name: 'set_transform',
    description: 'Set an object\'s position/rotation/scale (world space). In Motion mode this writes into the keyframe at the current playhead time (creating one there if needed) rather than a flat override.',
    inputSchema: { id: z.string(), transform: TRANSFORM },
  },
  {
    name: 'reset_transform',
    description: 'Reset an object back to its original spawn transform.',
    inputSchema: { id: z.string() },
  },
  {
    name: 'clear_scene',
    description: 'Remove every object from the scene. Undoable.',
    inputSchema: {},
  },
  {
    name: 'undo',
    description: 'Undo the last scene change.',
    inputSchema: {},
  },
  {
    name: 'redo',
    description: 'Redo the last undone scene change.',
    inputSchema: {},
  },
  {
    name: 'list_poses',
    description: 'List every pose in the Pose Library (authored, registry, and custom-saved), with id/name/category — use an id with apply_pose.',
    inputSchema: {},
  },
  {
    name: 'apply_pose',
    description: 'Apply a Pose Library entry to a character by id (see list_poses). Also re-grounds the character\'s feet.',
    inputSchema: { id: z.string(), poseId: z.string() },
  },
  {
    name: 'set_posture',
    description: 'Apply a raw mannequin-js posture object directly (advanced — the opaque {version, data:[...]} format returned by get_scene for a posed character). Prefer apply_pose for named poses; use this to replay/tweak a posture read from get_scene.',
    inputSchema: { id: z.string(), posture: z.object({ version: z.number(), data: z.array(z.any()) }) },
  },
  {
    name: 'reset_pose',
    description: 'Reset a character to its captured default posture (not a T-pose — whatever posture it spawned with).',
    inputSchema: { id: z.string() },
  },
  {
    name: 'save_pose',
    description: 'Save a character\'s current posture as a new custom entry in the Pose Library.',
    inputSchema: { id: z.string(), name: z.string() },
  },
  {
    name: 'set_shot',
    description: 'Configure shot size, camera angle, elevation, and/or composition and apply it to the viewport camera. Requires an object (any type except camera — mannequin or primitive) to already be selected (select_object) in Static mode. For angle "ots" (over-the-shoulder), a second character must already be in the scene — it becomes the OTS target automatically. Any field omitted keeps its current value.',
    inputSchema: { shotSize: SHOT_SIZE.optional(), angle: CAMERA_ANGLE.optional(), elevation: ELEVATION.optional(), composition: COMPOSITION.optional() },
  },
  {
    name: 'set_mode',
    description: 'Switch the editor between "static" (single cinematic frame) and "motion" (keyframed animation + timeline). The scene carries over either way.',
    inputSchema: { mode: z.enum(['static', 'motion']) },
  },
  {
    name: 'capture_shot',
    description: 'Render the current camera view as a PNG. By default returns the image directly in the tool result; pass download:true to instead trigger a save to the user\'s Downloads folder (like the in-app Capture Shot button) with no image returned.',
    inputSchema: { download: z.boolean().optional() },
  },
  {
    name: 'set_camera_fov',
    description: 'Set a camera object\'s field of view (10-120 degrees).',
    inputSchema: { id: z.string(), fov: z.number().min(1).max(179) },
  },
  {
    name: 'set_active_camera',
    description: 'Choose which camera object is the active/viewing camera — the one video export and the camera preview render through. A scene can hold several camera objects, each with its own independent keyframe track; this only changes which one is "live", it never touches any camera\'s keyframes.',
    inputSchema: { id: z.string() },
  },
  {
    name: 'set_camera_rig',
    description:
      'Set or clear a procedural camera rig — how to express cinematic intent ("orbit 360 degrees around them", "follow the runner") without generating a position/rotation keyframe for every frame. The camera\'s own keyframe track is untouched either way; a rig recalculates its transform fresh every frame from the target\'s current (independently animated) state, using stable vector/lookAt math (no hand-authored Euler rotation keyframes). Rig types: ' +
      '"follow" — hold a fixed world-space offset from targetId, always facing it. ' +
      '"orbit" — circle targetId at radius/height, sweeping startAngleDeg to endAngleDeg over duration seconds starting at startTime (default 0) on the shared timeline; holds at the end angle afterward — the core 360-orbit test case. ' +
      '"shot" — continuously re-solve one of the existing shot presets (same shotSize/angle/elevation/composition as set_shot/list_shot_presets) against targetId\'s live bounding box every frame, maintaining the framing while the target moves; secondaryTargetId is the "other" character an "ots" angle looks past the target toward. ' +
      '"none" — clear any rig and go back to free rotation from the camera\'s own track.',
    inputSchema: {
      id: z.string(),
      rig: z.discriminatedUnion('type', [
        z.object({ type: z.literal('none') }),
        z.object({ type: z.literal('follow'), targetId: z.string(), offset: VEC3 }),
        z.object({
          type: z.literal('orbit'),
          targetId: z.string(),
          radius: z.number().positive(),
          height: z.number(),
          startAngleDeg: z.number(),
          endAngleDeg: z.number(),
          duration: z.number().positive(),
          startTime: z.number().min(0).optional(),
        }),
        z.object({
          type: z.literal('shot'),
          targetId: z.string(),
          secondaryTargetId: z.string().optional(),
          shotSize: SHOT_SIZE,
          angle: CAMERA_ANGLE,
          elevation: ELEVATION,
          composition: COMPOSITION,
        }),
      ]),
    },
  },
  {
    name: 'add_shot_segment',
    description:
      'Append one shot to the Motion Shot Sequence — a run of re-solved shot presets (same shotSize/angle/elevation/composition as set_shot/list_shot_presets), each held for `duration` seconds (default 3) and re-solved live against its target\'s current bounding box every frame, so a wide->OTS->medium->close-up sequence keeps each framing correct even while targets move. This is store-level cut-list data, not a camera object — it drives one dedicated cinematic camera used only for Motion preview/export, and never touches the viewport camera or any camera object in the scene. `secondaryTargetId` is the "other" character an "ots" angle looks past `targetId` toward. Chain multiple calls to build a whole sequence — each segment starts right after the previous one ends.',
    inputSchema: {
      targetId: z.string(),
      secondaryTargetId: z.string().optional(),
      shotSize: SHOT_SIZE,
      angle: CAMERA_ANGLE,
      elevation: ELEVATION,
      composition: COMPOSITION,
      duration: z.number().positive().optional(),
    },
  },
  {
    name: 'get_shot_sequence',
    description: 'Read the Motion Shot Sequence — every segment\'s target, framing, duration, and derived start time (never stored, always the sum of every prior segment\'s duration), plus the sequence\'s total duration.',
    inputSchema: {},
  },
  {
    name: 'update_shot_segment',
    description: 'Patch one segment of the Motion Shot Sequence (target, secondary target, framing, and/or duration) — any field omitted keeps its current value.',
    inputSchema: {
      segmentId: z.string(),
      targetId: z.string().optional(),
      secondaryTargetId: z.string().optional(),
      shotSize: SHOT_SIZE.optional(),
      angle: CAMERA_ANGLE.optional(),
      elevation: ELEVATION.optional(),
      composition: COMPOSITION.optional(),
      duration: z.number().positive().optional(),
    },
  },
  {
    name: 'remove_shot_segment',
    description: 'Remove one segment from the Motion Shot Sequence.',
    inputSchema: { segmentId: z.string() },
  },
  {
    name: 'export_video',
    description: 'Render the Motion timeline through to a downloaded video file, the same recording the in-app Export Video button triggers. Plays the full timeline duration in real time before the download completes. If a Shot Sequence exists, exports through its dedicated cinematic camera; otherwise requires a camera set active (set_active_camera).',
    inputSchema: {},
  },
  {
    name: 'add_keyframe',
    description: 'Add a keyframe for an object (character, primitive, or camera) at a given time (seconds), capturing its current transform/posture/fov.',
    inputSchema: { id: z.string(), time: z.number().min(0) },
  },
  {
    name: 'update_keyframe',
    description: 'Overwrite an existing keyframe\'s transform.',
    inputSchema: { id: z.string(), keyframeId: z.string(), transform: TRANSFORM },
  },
  {
    name: 'delete_keyframe',
    description: 'Delete a keyframe from an object\'s track.',
    inputSchema: { id: z.string(), keyframeId: z.string() },
  },
  {
    name: 'duplicate_keyframe',
    description: 'Duplicate a keyframe on the same object\'s track.',
    inputSchema: { id: z.string(), keyframeId: z.string() },
  },
  {
    name: 'move_keyframe_time',
    description: 'Move a keyframe to a new time (seconds) on its object\'s track.',
    inputSchema: { id: z.string(), keyframeId: z.string(), time: z.number().min(0) },
  },
  {
    name: 'list_motions',
    description: 'List every saved Motion Library asset (id/name/category/objectType/duration) — use an id with apply_motion_preset.',
    inputSchema: {},
  },
  {
    name: 'apply_motion_preset',
    description: 'Apply a saved Motion Library keyframe sequence to an object. The motion\'s object type must be compatible (any mannequin motion works on any of male/female/child; camera/primitive motions require an exact type match).',
    inputSchema: { id: z.string(), motionId: z.string() },
  },
  {
    name: 'save_motion',
    description: 'Save an object\'s current keyframe sequence (2+ keyframes required) to the Motion Library for reuse.',
    inputSchema: { id: z.string(), name: z.string(), category: z.string().optional(), description: z.string().optional() },
  },
  {
    name: 'set_duration',
    description: 'Set the Motion timeline\'s total duration in seconds.',
    inputSchema: { duration: z.number().min(0.1) },
  },
  {
    name: 'set_playback',
    description: 'Control Motion playback: play/pause, scrub to a time (seconds), and/or change playback speed.',
    inputSchema: { playing: z.boolean().optional(), elapsed: z.number().min(0).optional(), speed: z.number().min(0.1).max(3).optional() },
  },
  {
    name: 'save_scene',
    description: 'Save the entire current scene (all objects, keyframes, duration, and shot framing) to the Scene Library under a name.',
    inputSchema: { name: z.string() },
  },
  {
    name: 'list_library',
    description: 'List every reusable entry across the unified library: static shots, saved motion scenes, saved motions, and poses.',
    inputSchema: {},
  },
];
