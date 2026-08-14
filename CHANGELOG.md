# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Pose library with bundled poses loaded from `public/poses/`, plus save, update, and delete for custom poses persisted in `localStorage`
- Joint rotation-ring gizmo for direct posing in the viewport
- Per-joint numeric controls in the Inspector covering every degree of freedom, including finger chains
- Limb and single-joint mirroring across the body's left/right sides
- Motion preview for Walk, Run, Kick, and Idle cycles on the selected figure
- Part Scale mode for resizing an individual body part (session-only)
- Ground action to re-plant a figure's feet on the floor plane
- Undo history for scene changes, with gizmo drags recorded as a single step
- Expanded camera presets to 11 angles, including bottom and the four corner views
- Keyboard shortcuts: `M`, `R`, `S`, `P` for tools and `C` for composition mode
- Mobile-responsive layout with a bottom tab bar below 768px

### Fixed
- Reset Pose restores the true default posture instead of zeroing all joints
- Capture Shot now resolves the renderer, scene, and camera from React Three Fiber context
- Mannequin no longer re-creates itself on Reset Pose

### Removed
- Debug screenshots, browser automation artifacts, and local tool config from version control

## [1.0.0] - 2026-08-05

### Added
- 3D shot composer built on React Three Fiber
- mannequin.js figures in male, female, and child variants
- Primitive objects: cube, plane, cylinder, sphere, capsule, cone, and torus
- Scene tree sidebar for object management
- Inspector with position, rotation, and scale fields
- Move, rotate, and scale gizmos
- Camera presets, Frame Selected, and Reset View
- Orbit controls: left drag to orbit, right drag to pan, wheel to dolly
- Grid and axes helpers with toggles
- Pose mode with click-to-select joint manipulation
- Capture Shot PNG export
- Composition controls for camera pedestal and truck moves
- Landing page and routing to the composer
- Zustand store for scene state

### Fixed
- mannequin.js canvas cleanup on route navigation
- WebGL context management and orbit control cleanup on unmount
