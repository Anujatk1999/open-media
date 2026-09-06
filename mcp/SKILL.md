# Driving Shot Composer as an agent

You have MCP tools connected to a running Shot Composer tab (see `mcp/README.md` for setup/architecture). This doc is the workflow guide: how to think about the scene, and what to do when a tool doesn't cover something.

## Scene model

- The scene is a flat list of **objects**: characters (`male`/`female`/`child`), primitives, and cameras. Call `get_scene` first, always — it's cheap and tells you what exists, what's selected, and playback state.
- Most tools act on **the current selection** if you omit `id`. `select_object` sets it. Call `select_object` before `set_shot` (it solves the shot relative to the selected character) and before pose/keyframe tools you want to target explicitly.
- **Shot framing** (`shotSize`, `angle`, `elevation`, `composition`) and **mode** (`static`/`motion`) are a single piece of state shared by the whole viewport, not per-object — `set_shot` merges whatever fields you pass into the existing values. Call `get_shot` to see current framing before making a partial change.
- **OTS** (`angle: "ots"`) needs a second character already in the scene; it auto-picks the nearest other character as the target — you don't pass a target id.
- **Posture** is mannequin.js's own opaque format (`{version, data:[...]}`). Don't hand-construct it. Get one from `get_scene` (an already-posed character), or apply a named pose via `list_poses` + `apply_pose` — that's the path for almost every posing task.
- **Motion mode** keyframes transform (and posture/fov for characters/cameras) at a given time on the timeline. `set_transform` in motion mode writes into the keyframe at the current playhead, creating one if needed — so scrub with `set_playback({ elapsed })` before setting poses/positions per-frame, or use `add_keyframe` at explicit times.
- Everything you build is disposable until you call `save_scene`, `save_pose`, or `save_motion` — those are the only tools that persist past a reload.

## Preferred workflow

1. `get_scene` — see what's there.
2. Build/adjust objects: `add_object`, `set_transform`, `apply_pose` (via `list_poses` first).
3. Frame it: `select_object` the subject, then `set_shot` (check `list_shot_presets` if you're unsure of valid ids).
4. For motion: `set_mode({ mode: "motion" })`, then `add_keyframe`/`apply_motion_preset` per object, `set_duration`, `set_playback` to preview.
5. `capture_shot` to see the result (returns a PNG inline) before deciding whether to iterate.
6. `save_scene` (and/or `save_pose`/`save_motion`) once you're happy with something reusable.

Prefer named library presets (`apply_pose`, `apply_motion_preset`, `set_shot` with the enum values) over manual transform/posture edits — they're what the tool table is built around, and they compose more predictably than freehand coordinates.

## When a capability seems missing

Don't work around a gap by inventing new behavior (e.g. hand-rolling a posture array, or trying to reach the DOM). Instead:

1. Check `src/stores/composerStore.ts` and the relevant helper modules (`src/modules/library/calibration/`, `src/modules/composer/helpers/`) for an existing action or function that already does what you need. If the app's UI can do it, there's a store action or helper behind it.
2. Add a handler to `src/modules/mcpBridge/commands.ts` that calls that existing action/helper — don't reimplement app logic in the bridge.
3. Add a matching tool definition to `mcp/tools.js` (name, description, Zod input schema) mirroring the existing entries.
4. `mcp/server.js`/`mcp/bridge.js` need no changes — they loop over `TOOLS` generically.

If no underlying store action exists at all, that's a real app-feature gap, not an MCP gap — it needs to be built in the app first (see `mcp/README.md`'s "Limitations" section for known gaps like video export and live gizmo dragging).
