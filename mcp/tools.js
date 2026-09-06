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
    description: 'Get every object in the current scene (id, name, type, transform, visibility, lock, posture presence, keyframes, fov) plus selection/playback state. Call this first to see what exists before changing anything.',
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
    description: 'Select an object by id. Required before set_shot in Static mode (the shot solves relative to the selected character), and before Pose/keyframe tools that act on "the selection" implicitly.',
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
    description: 'Configure shot size, camera angle, elevation, and/or composition and apply it to the viewport camera. Requires a character to already be selected (select_object) in Static mode. For angle "ots" (over-the-shoulder), a second character must already be in the scene — it becomes the OTS target automatically. Any field omitted keeps its current value.',
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
