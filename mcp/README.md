# Shot Composer MCP Server

A local [Model Context Protocol](https://modelcontextprotocol.io) server that lets an AI coding agent (Claude Code, Codex, Cursor, or any other MCP-compatible client) drive a running Shot Composer tab: build scenes, pose characters, frame shots, keyframe motion, and save results — through the same state and actions the UI itself uses, not by clicking around the page.

It is local-first and requires no account, backend, or deployment. It only talks to a Shot Composer tab open in your own browser.

## Architecture

```
AI agent (Claude Code, Codex, ...)
      │  MCP over stdio
      ▼
mcp/server.js  (this package — Node process)
      │  WebSocket, ws://localhost:39217
      ▼
Shot Composer tab (browser)
  src/modules/mcpBridge  →  useComposerStore (Zustand) + ComposerViewport + ComposerShell's shot controls
```

- **`mcp/server.js`** registers one MCP tool per capability (see [Tools](#tools)) and forwards each call to the browser over a WebSocket.
- **`mcp/bridge.js`** is that WebSocket server — it holds the one connected browser tab and matches replies back to the pending tool call.
- **`src/modules/mcpBridge/`** (inside the main app) is the browser-side half: it connects to `ws://localhost:39217` on page load, and executes each command against the real `composerStore` actions, `ComposerViewport`'s imperative API, and the shot-framing controls. See `src/modules/mcpBridge/commands.ts` for the exact mapping — every command calls an existing store action or helper, nothing is reimplemented.
- If no MCP server is running, the browser-side bridge fails to connect, logs one line, and retries quietly forever — it has zero effect on normal use of the app.
- If no browser tab is connected, every tool call returns a clear error instead of hanging.

Only one Shot Composer tab is bridged at a time; opening/reloading the page just replaces the active connection.

## Requirements

- Node.js 18+
- The main Shot Composer app running and open in a browser (`npm run dev` from the repo root, then visit the composer page)

## Install & run

```bash
cd mcp
npm install
npm start
```

This starts the MCP server on stdio (for your agent to talk to) and a WebSocket listener on port `39217` (for the browser tab to talk to). Leave it running alongside `npm run dev`.

## Connecting an agent

The server speaks standard MCP over stdio, so any MCP-compatible client works. Point it at `node <repo>/mcp/server.js` with an absolute path.

**Claude Code** (from the repo root, macOS/Linux/git-bash):
```bash
claude mcp add shot-composer -- node "$(pwd)/mcp/server.js"
```

**Windows note**: `$(pwd)` is a bash-ism — it works in Git Bash/WSL, but not in PowerShell or `cmd.exe`. In those shells, just pass the absolute path directly instead:
```powershell
claude mcp add shot-composer -- node C:\path\to\open-media\mcp\server.js
```

**Generic JSON config** (Claude Desktop, and other clients that read an `mcpServers` block — e.g. a project's `.mcp.json`):
```json
{
  "mcpServers": {
    "shot-composer": {
      "command": "node",
      "args": ["/absolute/path/to/open-media/mcp/server.js"]
    }
  }
}
```

**Cursor**: uses the same `mcpServers` JSON block above, in `.cursor/mcp.json` (project-local) or the global `~/.cursor/mcp.json` — copy the generic JSON config as-is into that file.

**Codex CLI**: add an entry under `mcp_servers` in `~/.codex/config.toml` (or the project's `.codex/config.toml`):
```toml
[mcp_servers.shot-composer]
command = "node"
args = ["/absolute/path/to/open-media/mcp/server.js"]
```
Codex's config format has changed before and may again — if this doesn't work, check Codex's current MCP documentation for the exact table/key names, since this only depends on `command`/`args` being a plain `node server.js` invocation.

**Other clients**: use the same `command`/`args` pair in whatever config format that client expects.

## Verify the connection

1. Start the main app: `npm run dev` (from the repo root), then open the composer page in a browser.
2. Start the MCP server: `npm start` (from `mcp/`). Leave both running.
3. From your connected agent, call the `get_scene` tool with no arguments.

**Success**: the browser tab logs `[mcp-bridge] connected to local MCP server.` in its console, and `get_scene` returns JSON describing the current scene (an empty `objects` array if you haven't added anything yet, plus selection/playback state).

**Failure**: if no tab is open yet, or the tab hasn't connected, every tool call returns `Error: No Shot Composer tab is connected. Open the app (npm run dev, then visit the composer) in a browser and try again.` — start/reload the composer tab and try again.

## Example agent prompts

> "Get the current scene, then add a second character standing a couple meters away."

> "Pose the first character with the 'standing-relaxed' pose from the library, then set up an over-the-shoulder shot looking at the second character."

> "Switch to Motion mode, animate the first character walking from their current position to (3, 0, 0) over 2 seconds, add a slow camera push-in over the same duration, then save the scene as 'hallway-approach'."

> "Capture the current shot and show it to me."

## Tools

Scene inspection:

| Tool | Params | Description |
| --- | --- | --- |
| `get_scene` | — | List every object (transform, visibility, lock, posture presence, keyframes, fov) plus selection/playback state |
| `get_shot` | — | Current shot size/angle/elevation/composition and static/motion mode |
| `list_shot_presets` | — | Valid ids + labels for shot size, camera angle, elevation, composition |

Objects:

| Tool | Params | Description |
| --- | --- | --- |
| `add_object` | `type` | Add a character (`male`/`female`/`child`), primitive, or `camera` — becomes selected |
| `duplicate_object` | `id?` | Duplicate an object (defaults to the selection) |
| `delete_object` | `id?` | Delete an object (defaults to the selection) |
| `select_object` | `id` | Select an object |
| `rename_object` | `id, name` | Rename an object |
| `toggle_visibility` | `id` | Toggle visibility |
| `toggle_lock` | `id` | Toggle transform lock |
| `set_transform` | `id, transform` | Set position/rotation/scale (any subset) |
| `reset_transform` | `id` | Reset to spawn transform |
| `clear_scene` | — | Remove every object |
| `undo` / `redo` | — | Undo/redo the last scene change |

Pose:

| Tool | Params | Description |
| --- | --- | --- |
| `list_poses` | — | List Pose Library entries (authored, registry, custom) |
| `apply_pose` | `id, poseId` | Apply a library pose to a character |
| `set_posture` | `id, posture` | Apply a raw posture object (advanced — see below) |
| `reset_pose` | `id` | Reset to captured default posture |
| `save_pose` | `id, name` | Save a character's current posture to the Pose Library |

Shot framing & camera:

| Tool | Params | Description |
| --- | --- | --- |
| `set_shot` | `shotSize?, angle?, elevation?, composition?` | Configure and apply the shot camera. Requires a selected character; `angle: "ots"` needs a second character already in the scene |
| `set_mode` | `mode` | Switch between `static` and `motion` |
| `capture_shot` | `download?` | Render the current camera view — returns a PNG image by default, or triggers a file download if `download: true` |
| `set_camera_fov` | `id, fov` | Set a camera object's field of view |

Keyframes & motion:

| Tool | Params | Description |
| --- | --- | --- |
| `add_keyframe` | `id, time` | Add a keyframe at a time (seconds) |
| `update_keyframe` | `id, keyframeId, transform` | Overwrite a keyframe's transform |
| `delete_keyframe` | `id, keyframeId` | Delete a keyframe |
| `duplicate_keyframe` | `id, keyframeId` | Duplicate a keyframe |
| `move_keyframe_time` | `id, keyframeId, time` | Move a keyframe to a new time |
| `list_motions` | — | List Motion Library assets |
| `apply_motion_preset` | `id, motionId` | Apply a saved keyframe sequence to a compatible object |
| `save_motion` | `id, name, category?, description?` | Save an object's keyframe sequence (2+ keyframes) |
| `set_duration` | `duration` | Set the timeline's total length (seconds) |
| `set_playback` | `playing?, elapsed?, speed?` | Play/pause, scrub, or change speed |

Saving & library:

| Tool | Params | Description |
| --- | --- | --- |
| `save_scene` | `name` | Save the whole scene (objects, keyframes, duration, shot framing) |
| `list_library` | — | List every reusable entry: static shots, saved motion scenes, saved motions, poses |

### A note on `set_posture`

Character posture is mannequin.js's own opaque, versioned format (`{ version, data: [...] }`) — a flat array of per-joint angle entries, not a friendly named-joint object. There is no existing "set this joint to this angle" store action to wrap, so `set_posture` passes the object straight to `updateObjectPosture`. In practice, get a valid posture object either from `get_scene` (read an existing posed character's `posture` field), from `list_poses` + `apply_pose` (recommended for most cases), or by modifying a posture read from one of those.

## Limitations / not yet exposed

- Only one Shot Composer tab can be bridged at a time.
- The Community library tab is a "coming soon" placeholder in the app itself — `list_library` reflects that (no community entries).
- UI-only interactions with no underlying store action aren't exposed: composition-mode arrow-key nudging, live gizmo dragging, mirroring a pose across the body, and "Part Scale" mode.
- Video export (`exportVideo` on `ComposerViewportAPI`) isn't wrapped as a tool yet — capture is still image-only. Adding it would follow the exact same pattern as `capture_shot`.
- `capture_shot` renders through the live, on-screen camera (whatever is currently framed), not an offscreen/headless render.

## Troubleshooting

**`Error: listen EADDRINUSE: address already in use :::39217`** — something is already bound to port 39217, almost always a previous `mcp/server.js` process that didn't exit cleanly. Find and stop it (e.g. `lsof -i :39217` on macOS/Linux, `netstat -ano | findstr 39217` on Windows, then stop that process), then run `npm start` again. Only one MCP server instance can run at a time.

**`No Shot Composer tab is connected.`** — the MCP server is running but no browser tab has connected to it yet. Make sure `npm run dev` is running and the composer page is open in a browser tab; check that tab's console for the `[mcp-bridge]` connect/retry log lines.

**Tool calls hang or fail after refreshing/reopening the composer tab** — reloading a page always reconnects (the bridge retries every 2 seconds), but if you closed the old tab and opened a new one, or opened a second tab, only the most recently connected tab is bridged — an old tab's connection is simply replaced, it isn't an error. If calls still hang, confirm the tab you're testing in is the one that logged `[mcp-bridge] connected`, and that `mcp/server.js` itself hasn't crashed (check its terminal output).

## Extending this

If a capability doesn't exist yet, add it in this order, matching every existing entry:

1. Confirm the underlying capability actually exists in `src/stores/composerStore.ts` or the relevant helper module. Don't invent new app behavior here — that belongs in the app itself.
2. Add a handler to `src/modules/mcpBridge/commands.ts` that calls it.
3. Add a matching tool definition to `mcp/tools.js` (name, description, Zod input schema).
4. No change to `mcp/server.js` or `mcp/bridge.js` is needed — both are generic and loop over `TOOLS`.

See `SKILL.md` for the agent-facing guide (workflow, scene model, and this same extension process aimed at an agent doing the work).
