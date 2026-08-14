# Contributing to Shot Composer

Thanks for your interest in contributing. Shot Composer is a browser-based 3D previsualization tool for shot planning and pose reference.

## Getting started

Requires Node.js 18+.

1. Fork the repository
2. Clone your fork: `git clone https://github.com/your-username/open-media.git`
3. Install dependencies: `npm install`
4. Start the dev server: `npm run dev`

## Development workflow

1. Create a branch: `git checkout -b feature/your-feature-name`
2. Make your changes
3. Verify the build passes: `npm run build` (runs `tsc --noEmit` then the Vite build)
4. Test the change in the browser at `/composer` — there is no automated test suite, so exercise the affected tool manually
5. Open a pull request

## Code style

- TypeScript strict mode
- React function components with hooks
- Zustand for shared scene state; local `useState` for UI-only state
- Plain CSS files colocated with their component
- No unused imports, dead code, or leftover `console.log`

## Architecture notes

- `src/stores/composerStore.ts` owns scene objects, selection, active tool, and undo history. Every mutation flows through it, which is how undo works without per-action instrumentation.
- `src/modules/composer/` holds the viewport, panels, gizmos, and helpers. See the project structure table in the [README](README.md).
- mannequin.js is the character system. Please do not swap it for another rigging library.
- Continuous edits (gizmo drags) must be bracketed as one undo step rather than one per frame.

## Pull request guidelines

- Keep PRs focused on a single feature or fix
- Describe what changed and how you verified it
- Do not commit debug screenshots, browser automation artifacts, build output, or local editor/tool config — see `.gitignore`

## Reporting issues

Use GitHub Issues. Please include:

- Steps to reproduce
- Expected vs. actual behavior
- Browser and OS
- Screenshots or a short recording where relevant
