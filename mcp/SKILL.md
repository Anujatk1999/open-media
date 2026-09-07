# Driving Shot Composer as an agent

You have MCP tools connected to a running Shot Composer tab (see `mcp/README.md` for setup/architecture). This doc is the workflow guide: how to think about the scene, and what to do when a tool doesn't cover something.

## Scene model

- The scene is a flat list of **objects**: characters (`male`/`female`/`child`), primitives, and cameras. Call `get_scene` first, always — it's cheap and tells you what exists, what's selected, and playback state.
- Most tools act on **the current selection** if you omit `id`. `select_object` sets it. Call `select_object` before `set_shot` (it solves the shot relative to the selected object — any type except camera, mannequin or primitive) and before pose/keyframe tools you want to target explicitly.
- **Shot framing** (`shotSize`, `angle`, `elevation`, `composition`) and **mode** (`static`/`motion`) are a single piece of state shared by the whole viewport, not per-object — `set_shot` merges whatever fields you pass into the existing values. Call `get_shot` to see current framing before making a partial change.
- **OTS** (`angle: "ots"`) needs a second character already in the scene; it auto-picks the nearest other character as the target — you don't pass a target id.
- **Posture** is mannequin.js's own opaque format (`{version, data:[...]}`). Don't hand-construct it. Get one from `get_scene` (an already-posed character), or apply a named pose via `list_poses` + `apply_pose` — that's the path for almost every posing task.
- **Motion mode** keyframes transform (and posture/fov for characters/cameras) at a given time on the timeline. `set_transform` in motion mode writes into the keyframe at the current playhead, creating one if needed — so scrub with `set_playback({ elapsed })` before setting poses/positions per-frame, or use `add_keyframe` at explicit times.
- Each object's keyframe track is independent, but every object shares the same `playback` (elapsed/duration/speed) — a character and one or more cameras can be keyframed and played back concurrently (e.g. a character walking while a camera independently moves) with no cross-talk between their tracks, and this is evaluated identically during playback and MP4 export. If a scene has multiple cameras, `set_active_camera` picks which one export/preview actually renders through.
- For cinematic camera behavior that shouldn't require per-frame keyframes, use `set_camera_rig({ id, rig })` instead of hand-generating a keyframe at every frame: `follow` (hold a fixed offset from a moving target), `orbit` (circle a target — the 360° test case is `startAngleDeg: 0, endAngleDeg: 360` over a `duration`), or `shot` (continuously re-solve a `set_shot`-style preset against a moving target's live bounding box, so a medium/wide/close-up/OTS framing is *maintained* while the subject moves, not just applied once). A rig recalculates fresh every frame from the target's current animated state and never touches the camera's own keyframe track — `rig: { type: "none" }` clears it. This is the tool for "have the character run across the field while the camera tracks them in a medium shot" or "orbit 360 degrees around the character".
- For a whole cut of shots ("wide, then OTS, then close-up"), don't juggle multiple `set_camera_rig` calls with manual start times — use `add_shot_segment` instead, once per shot in order. Each call appends one `shot`-style framing (target, secondary target for OTS, shotSize/angle/elevation/composition, duration) to the Motion Shot Sequence, a store-level cut list, not a camera object or rig; segments play back to back, each re-solved live every frame like a standalone `shot` rig, with no gap or hold between them. It drives one dedicated cinematic camera used only for Motion preview/export — it never creates or selects a camera object, and never touches the editor viewport camera, so you're always free to orbit/zoom the viewport or edit characters without affecting the sequence. `get_shot_sequence` reads back every segment (including each one's derived start time), `update_shot_segment`/`remove_shot_segment` edit it afterward.
- `export_video` renders the Motion timeline to a downloaded video file — the same thing the in-app Export Video button does. It requires Motion mode, and runs in real time (recording a 12-second timeline takes about 12 seconds), so prefer `capture_shot` for a quick single-frame check and save `export_video` for when you actually want the file. It exports through the Shot Sequence's dedicated camera when one exists, otherwise through whichever camera object is set active.
- Everything you build is disposable until you call `save_scene`, `save_pose`, or `save_motion` — those are the only tools that persist past a reload. There is also no way to load a saved scene back into the live session yet — that's a pre-existing app gap, not something specific to any one tool.

## Preferred workflow

1. `get_scene` — see what's there.
2. Build/adjust objects: `add_object`, `set_transform`, `apply_pose` (via `list_poses` first).
3. Frame it: `select_object` the subject, then `set_shot` (check `list_shot_presets` if you're unsure of valid ids).
4. For motion: `set_mode({ mode: "motion" })`, then `add_keyframe`/`apply_motion_preset` per object, and/or `add_shot_segment` (repeated) for a camera cut list; `set_duration`, `set_playback` to preview.
5. `capture_shot` to see a single frame (returns a PNG inline) before deciding whether to iterate; `export_video` once you actually want the rendered file.
6. `save_scene` (and/or `save_pose`/`save_motion`) once you're happy with something reusable.

Prefer named library presets (`apply_pose`, `apply_motion_preset`, `set_shot` with the enum values) over manual transform/posture edits — they're what the tool table is built around, and they compose more predictably than freehand coordinates.

## When a capability seems missing

Don't work around a gap by inventing new behavior (e.g. hand-rolling a posture array, or trying to reach the DOM). Instead:

1. Check `src/stores/composerStore.ts` and the relevant helper modules (`src/modules/library/calibration/`, `src/modules/composer/helpers/`) for an existing action or function that already does what you need. If the app's UI can do it, there's a store action or helper behind it.
2. Add a handler to `src/modules/mcpBridge/commands.ts` that calls that existing action/helper — don't reimplement app logic in the bridge.
3. Add a matching tool definition to `mcp/tools.js` (name, description, Zod input schema) mirroring the existing entries.
4. `mcp/server.js`/`mcp/bridge.js` need no changes — they loop over `TOOLS` generically.

If no underlying store action exists at all, that's a real app-feature gap, not an MCP gap — it needs to be built in the app first (see `mcp/README.md`'s "Limitations" section for known gaps like video export and live gizmo dragging).
