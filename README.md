# Open Media — Shot Composer AI

Local-first previsualization tooling for clear AI filmmaking references.

**Repository**: https://github.com/Anujatk1999/open-media

## Overview

Shot Composer AI is a previsualization tool designed for AI filmmakers to create and compose cinematic shots using 3D characters and objects. The tool provides a 3D workspace for shot composition with human figures, primitives, and camera controls.

## Features

- **3D Shot Composer** - Full 3D workspace with React Three Fiber viewport
- **Mannequin.js Integration** - Articulated human figures (male, female, child)
- **Scene Management** - Add, select, duplicate, delete, and organize scene objects
- **Transform Controls** - Move, rotate, scale with gizmo and numeric inputs
- **Pose Mode** - Click-drag joint manipulation for pose editing
- **Camera Controls** - Orbit/pan/dolly, preset views (Front, Side, Top, Perspective), frame selected, reset view
- **Shot Capture** - Export current viewport as PNG
- **Composition Tools** - Camera pedestal/truck controls
- **Responsive Layout** - Collapsible sidebar, inspector panel, full-viewport canvas

## Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

## Navigation

- **Left drag**: Orbit camera
- **Right drag**: Pan camera
- **Wheel**: Dolly/zoom
- **Toolbar buttons**: Preset camera views, frame selected, reset view
- **Pose tool**: Click and drag on mannequin body parts to pose joints

## Project Structure

```
src/
├── app/                    # Main app routing and layout
│   ├── App.tsx            # Routes: / (Landing) and /composer
│   └── app.css            # Global styles
├── main.tsx               # Application entry point
├── modules/
│   └── composer/          # 3D Shot Composer
│       ├── ComposerViewport.tsx
│       ├── MannequinObject.tsx
│       ├── PrimitiveObject.tsx
│       ├── SceneTree.tsx
│       ├── Inspector.tsx
│       ├── PoseControls.tsx
│       ├── TransformGizmo.tsx
│       ├── WorkspaceToolbar.tsx
│       ├── CompositionControls.tsx
│       ├── cameraUtils.ts
│       └── helpers/
│           ├── mannequinFactory.ts
│           └── jointConfig.ts
├── stores/
│   └── composerStore.ts   # Zustand state management
└── types/
    └── mannequin-js.d.ts
```

## Tech Stack

- **React 18** + **TypeScript** + **Vite**
- **React Three Fiber** + **@react-three/drei** for 3D
- **Three.js** for WebGL rendering
- **Mannequin.js** for articulated figures
- **React Router v7** for navigation
- **Zustand** for state management

## Scripts

- `npm run dev` - Start development server
- `npm run build` - Type check and build for production

## License

MIT License - see [LICENSE](LICENSE) for details.