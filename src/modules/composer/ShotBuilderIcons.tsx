/**
 * Plain visual icons for the Shot Builder panel — a frame, a dot, a tiny
 * camera glyph. No axis labels, no degree numbers, no dashed measurement
 * lines: the Library's ShotLibraryIcons.tsx tried that and the brief calls it
 * out by name as "technical diagrams" to avoid. Position/proportion data is
 * still reused from shotSolver.ts so these can never silently drift from
 * what solveShot actually does — only the rendering is deliberately dumbed down.
 */
import type { CameraAngle, Elevation, ShotSize } from "../library/calibration/shotSolver";
import { ANGLE_AZIMUTH_DEG, ELEVATION_RATIO, SHOT_SIZE_SPAN } from "../library/calibration/shotSolver";
import type { CompositionPreset } from "../library/calibration/shotSolver";

const FRAME: React.CSSProperties = { width: 34, height: 34 };

function FigureSilhouette({ cy = 20, scale = 1 }: { cy?: number; scale?: number }) {
  return (
    <g transform={`translate(17 ${cy}) scale(${scale})`}>
      <circle cx="0" cy="-8" r="3.4" fill="currentColor" opacity={0.85} />
      <path d="M-5 8 C-5 0 -3 -3 0 -3 C3 -3 5 0 5 8 Z" fill="currentColor" opacity={0.85} />
    </g>
  );
}

export function ShotSizeIcon({ shotSize }: { shotSize: ShotSize }) {
  const span = SHOT_SIZE_SPAN[shotSize];
  // Bigger top/bottom span -> the figure reads smaller inside the frame.
  const visSpan = span.top - span.bottom;
  const scale = Math.max(0.55, Math.min(1.5, 1.75 / visSpan));
  return (
    <svg style={FRAME} viewBox="0 0 34 34" fill="none" stroke="currentColor" strokeWidth="1.4" overflow="hidden">
      <rect x="2" y="2" width="30" height="30" rx="4" opacity={0.5} />
      <FigureSilhouette cy={22} scale={scale} />
    </svg>
  );
}

export function AngleIcon({ angle }: { angle: CameraAngle }) {
  const az = azimuthToXY(ANGLE_AZIMUTH_DEG[angle]);
  return (
    <svg style={FRAME} viewBox="0 0 34 34" fill="none" stroke="currentColor" strokeWidth="1.4">
      <circle cx="17" cy="17" r="14" opacity={0.35} />
      <circle cx="17" cy="17" r="3" fill="currentColor" opacity={0.85} />
      <CameraGlyph x={17 + az.x * 12} y={17 + az.y * 12} />
    </svg>
  );
}

export function ElevationIcon({ elevation }: { elevation: Elevation }) {
  const ratio = ELEVATION_RATIO[elevation];
  // ratio is "as a fraction of character height" (eye ~0.93, low ~0.15, high ~1.35);
  // remap just far enough to place the glyph clearly low / mid / high in the frame.
  const y = 29 - Math.min(1, ratio / 1.35) * 22;
  return (
    <svg style={FRAME} viewBox="0 0 34 34" fill="none" stroke="currentColor" strokeWidth="1.4">
      <line x1="4" y1="29" x2="30" y2="29" opacity={0.5} />
      <FigureSilhouette cy={26} scale={0.85} />
      <CameraGlyph x={28} y={y} />
    </svg>
  );
}

export function CompositionIcon({ composition }: { composition: CompositionPreset }) {
  const x = 4 + composition.screenX * 26;
  const y = 30 - composition.screenY * 26;
  return (
    <svg style={FRAME} viewBox="0 0 34 34" fill="none" stroke="currentColor" strokeWidth="1.4">
      <rect x="3" y="3" width="28" height="28" rx="3" opacity={0.5} />
      <circle cx={x} cy={y} r="3.4" fill="currentColor" opacity={0.9} />
    </svg>
  );
}

function CameraGlyph({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x - 4} ${y - 3})`} strokeWidth="1.3">
      <rect x="0" y="1.5" width="8" height="5.5" rx="1" />
      <path d="M2.5 1.5l1-1.3h1l1 1.3" />
    </g>
  );
}

function azimuthToXY(deg: number): { x: number; y: number } {
  const rad = (deg * Math.PI) / 180;
  return { x: Math.sin(rad), y: -Math.cos(rad) };
}
