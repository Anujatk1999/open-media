# Shot Composer

A browser-based 3D shot composer for previsualization. Block out a scene with posable human figures and primitive shapes, frame it with a camera, and export the frame as a PNG reference — useful for storyboarding, shot planning, and generating pose/composition references for AI image and video tools.

Everything runs locally in the browser. There is no backend, no account, and no data leaves your machine.

**Repository**: https://github.com/Anujatk1999/open-media

## Features

### Scene building
- Add articulated human figures — **male**, **female**, and **child** (powered by [mannequin.js](https://github.com/boytchev/mannequin.js))
- Add primitives — **cube, plane, cylinder, sphere, capsule, cone, torus**
- Scene tree sidebar to select, rename, duplicate, and delete objects
- Undo for scene changes (50 steps, in-memory)

### Transform tools
- **Move**, **Rotate**, and **Scale** via viewport gizmos or numeric fields in the Inspector
- Each gizmo drag is recorded as a single undo step

### Posing
- **Pose** tool: click any body part in the viewport to select that joint
- Rotation-ring gizmo in the viewport for direct joint dragging
- Numeric sliders and inputs in the Inspector for every joint's degrees of freedom, using mannequin.js's named angles (`raise`, `straddle`, `bend`, `tilt`, `turn`) plus finger chains
- **Mirroring** — copy an entire limb chain, or a single joint, to the opposite side
- **Reset Pose** restores the figure's default posture; **Ground** re-plants the feet on the floor plane
- **Part Scale** mode resizes an individual body part (session-only — not stored in saved poses)

### Pose library
- Bundled poses loaded from `public/poses/` (standing, sitting, walking, combat, injured, dead, sleeping, hero)
- Save your own poses, update existing ones, and delete custom entries
- Custom poses persist in `localStorage` per browser

### Motion preview
- Built-in **Walk**, **Run**, **Kick**, and **Idle** cycles play on the selected figure
- Preview only — stopping playback restores the posture from before you pressed play

### Camera and framing
- Orbit, pan, and dolly navigation
- 11 camera presets: Front, Back, Left, Right, Top, Bottom, Front Left, Front Right, Back Left, Back Right, Isometric
- **Frame Selected**, **Reset View**, and zoom controls
- **Composition mode** for arrow-key camera pedestal/truck adjustments
- Grid toggle

### Export
- **Capture Shot** saves the current viewport as a timestamped PNG

### Responsive layout
- Desktop: scene tree on the left, viewport in the center, Inspector on the right
- Below 768px: full-screen panels with a bottom tab bar and a compact tool/zoom toolbar

## Getting started

Requires **Node.js 18+**.

```bash
git clone https://github.com/Anujatk1999/open-media.git
cd open-media
npm install
npm run dev
```

The dev server prints a local URL (typically `http://localhost:5173`). Open it and click through to the composer at `/composer`.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the Vite dev server with hot reload |
| `npm run build` | Type check (`tsc --noEmit`) and build to `dist/` |

## Controls

| Input | Action |
| --- | --- |
| Left drag | Orbit camera |
| Right drag | Pan camera |
| Wheel | Dolly / zoom |
| `M` / `R` / `S` / `P` | Move / Rotate / Scale / Pose tool |
| `C` | Toggle composition mode |
| Click body part (Pose tool) | Select a joint |

Shortcuts are ignored while a text field is focused or a modifier key is held.

## Project structure

```
public/
└── poses/                     # Bundled pose library (JSON)

src/
├── main.tsx                   # Entry point
├── ComposerShell.tsx          # Desktop / mobile layout shell
├── app/
│   ├── App.tsx                # Routes: / (landing) and /composer
│   └── app.css
├── modules/composer/
│   ├── ComposerViewport.tsx   # R3F canvas, keyboard shortcuts, capture
│   ├── WorkspaceToolbar.tsx   # Tools, camera presets, grid, capture
│   ├── SceneTree.tsx          # Object list and add/remove controls
│   ├── Inspector.tsx          # Transform fields and camera presets
│   ├── PosePanel.tsx          # Pose library, mirroring, motion buttons
│   ├── JointControls.tsx      # Per-joint numeric sliders
│   ├── JointGizmo.tsx         # Viewport joint rotation rings
│   ├── TransformGizmo.tsx     # Move / rotate / scale gizmos
│   ├── PoseControls.tsx       # Joint picking via raycast
│   ├── MotionPlayer.tsx       # Walk / run / kick / idle playback
│   ├── MannequinObject.tsx    # mannequin.js figure wrapper
│   ├── PrimitiveObject.tsx    # Primitive mesh wrapper
│   ├── CompositionControls.tsx
│   ├── cameraUtils.ts         # Framing and view presets
│   └── helpers/
│       ├── jointConfig.ts     # Joint definitions and DOF ranges
│       ├── mannequinFactory.ts
│       ├── mirror.ts          # Limb / joint mirroring
│       ├── motion.ts          # Motion cycle definitions
│       ├── poseLibrary.ts     # Bundled + custom pose loading
│       ├── posture.ts         # Posture serialization
│       └── gizmoArrowheads.ts
├── stores/
│   └── composerStore.ts       # Zustand scene state and undo history
└── types/
    └── mannequin-js.d.ts
```

## Tech stack

| Package | Role |
| --- | --- |
| [React](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/) | UI and type safety |
| [Vite](https://vite.dev/) | Dev server and build |
| [three.js](https://threejs.org/) | WebGL rendering |
| [@react-three/fiber](https://github.com/pmndrs/react-three-fiber) + [drei](https://github.com/pmndrs/drei) | React renderer for three.js |
| [mannequin.js](https://github.com/boytchev/mannequin.js) | Articulated human figures |
| [React Router](https://reactrouter.com/) | Routing |
| [Zustand](https://github.com/pmndrs/zustand) | State management |

## Data and persistence

Scene contents live in memory and are cleared on reload — there is currently no scene save/load or import/export. Only custom poses persist, in browser `localStorage`.

## Deployment

`npm run build` emits a fully static site to `dist/`, deployable to any static host. Configure your host to serve it as a single-page application so that client-side routes such as `/composer` fall back to `index.html`.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE)
