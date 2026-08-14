import { useThree } from '@react-three/fiber';
import { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';

export type CompositionDirection = 'left' | 'right' | 'up' | 'down';

export interface CompositionCommand {
  direction: CompositionDirection;
  timestamp: number;
}

interface CompositionControllerProps {
  enabled: boolean;
  command: CompositionCommand | null;
  onCommandConsumed: () => void;
}

// Controller component - runs INSIDE Canvas, uses useThree()
export function CompositionController({ enabled, command, onCommandConsumed }: CompositionControllerProps) {
  const { camera, gl } = useThree();
  const lastProcessedRef = useRef<number>(0);

  /** Fraction of the distance to the subject per nudge, so one press shifts the
   *  frame by the same amount whether the shot is a close-up or a wide. */
  const MOVEMENT_STEP = 0.06;

  const moveCamera = useCallback((direction: CompositionDirection) => {
    if (!camera || !enabled) return;
    const cam = camera as THREE.PerspectiveCamera;
    const controls = (cam as any).__orbitControls as
      | { target: THREE.Vector3; update: () => void }
      | undefined;
    if (!controls) return;

    // Camera position and orbit target must move together — that is what a pan
    // is. Moving the position alone is an orbit: OrbitControls rebuilds the
    // position from `target + spherical offset` on the next update, so the
    // camera swings back around the subject and the framing never shifts.
    const step = MOVEMENT_STEP * cam.position.distanceTo(controls.target);
    // Columns 0 and 1 of the camera matrix are its screen right and up, which
    // keeps a nudge parallel to the frame edge at any angle — the same basis
    // OrbitControls pans on with screenSpacePanning.
    const axis = new THREE.Vector3().setFromMatrixColumn(cam.matrix, direction === 'up' || direction === 'down' ? 1 : 0);
    axis.multiplyScalar(direction === 'left' || direction === 'down' ? -step : step);

    cam.position.add(axis);
    controls.target.add(axis);
    controls.update();
  }, [camera, enabled]);

  /**
   * Composition mode turns left-drag into the pan the arrows do, so the frame
   * can be dragged straight to where it belongs. It is OrbitControls' own pan,
   * only rebound — nothing about orbit, dolly or the presets changes, and
   * OrbitControls' modifier rule leaves Shift + left-drag as orbit while the
   * mode is on. `mouseButtons` is a shared object, so LEFT is flipped in place.
   */
  useEffect(() => {
    const controls = (camera as any).__orbitControls as
      | { mouseButtons: { LEFT: number } }
      | undefined;
    if (!enabled || !controls) return;

    const dom = gl.domElement;
    const restore = controls.mouseButtons.LEFT;
    controls.mouseButtons.LEFT = THREE.MOUSE.PAN;
    dom.style.cursor = "grab";

    const grab = () => { dom.style.cursor = "grabbing"; };
    const release = () => { dom.style.cursor = "grab"; };
    dom.addEventListener("pointerdown", grab);
    window.addEventListener("pointerup", release);

    return () => {
      controls.mouseButtons.LEFT = restore;
      dom.style.cursor = "";
      dom.removeEventListener("pointerdown", grab);
      window.removeEventListener("pointerup", release);
    };
  }, [enabled, camera, gl]);

  // Process command when it changes
  useEffect(() => {
    if (command && command.timestamp > lastProcessedRef.current) {
      moveCamera(command.direction);
      lastProcessedRef.current = command.timestamp;
      onCommandConsumed();
    }
  }, [command, enabled, moveCamera, onCommandConsumed]);

  return null; // No UI - pure logic
}

// UI component - pure React, runs OUTSIDE Canvas
interface CompositionControlsProps {
  enabled: boolean;
  onMove: (direction: CompositionDirection) => void;
}

export function CompositionControls({ enabled, onMove }: CompositionControlsProps) {
  const [thirds, setThirds] = useState(true);
  if (!enabled) return null;

  const handleMouseDown = (direction: CompositionDirection) => {
    onMove(direction);
    const interval = window.setInterval(() => onMove(direction), 50);

    const cleanup = () => {
      window.clearInterval(interval);
      document.removeEventListener('mouseup', cleanup);
      document.removeEventListener('mouseleave', cleanup);
      document.removeEventListener('touchend', cleanup);
    };

    document.addEventListener('mouseup', cleanup, { once: true });
    document.addEventListener('mouseleave', cleanup, { once: true });
    document.addEventListener('touchend', cleanup, { once: true });
  };

  return (
    <>
      {thirds && <ThirdsOverlay />}
      <div className="composition-controls" onMouseDown={(e) => e.stopPropagation()}>
      <button
        className="composition-btn"
        onMouseDown={(e) => { e.stopPropagation(); handleMouseDown('up'); }}
        onTouchStart={(e) => { e.preventDefault(); e.stopPropagation(); handleMouseDown('up'); }}
        title="Pedestal Up"
      >
        ↑
      </button>
      <div className="composition-row">
        <button
          className="composition-btn"
          onMouseDown={(e) => { e.stopPropagation(); handleMouseDown('left'); }}
          onTouchStart={(e) => { e.preventDefault(); e.stopPropagation(); handleMouseDown('left'); }}
          title="Truck Left"
        >
          ←
        </button>
        <button
          className="composition-btn"
          onMouseDown={(e) => { e.stopPropagation(); handleMouseDown('right'); }}
          onTouchStart={(e) => { e.preventDefault(); e.stopPropagation(); handleMouseDown('right'); }}
          title="Truck Right"
        >
          →
        </button>
      </div>
      <button
        className="composition-btn"
        onMouseDown={(e) => { e.stopPropagation(); handleMouseDown('down'); }}
        onTouchStart={(e) => { e.preventDefault(); e.stopPropagation(); handleMouseDown('down'); }}
        title="Pedestal Down"
      >
        ↓
      </button>
      <button
        className={`composition-btn${thirds ? ' on' : ''}`}
        onMouseDown={(e) => { e.stopPropagation(); setThirds((v) => !v); }}
        title="Rule-of-thirds grid"
      >
        ⌗
      </button>
      </div>
    </>
  );
}

/**
 * Rule-of-thirds guides, drawn over the canvas rather than in it: a 3D grid
 * would sit at some depth in the scene, move with the camera and land in the
 * captured PNG. Two elements, four borders — the lines are the box edges.
 */
function ThirdsOverlay() {
  const line = '1px solid rgba(255,255,255,.28)';
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 9 }} aria-hidden>
      <div style={{ position: 'absolute', top: 0, bottom: 0, left: '33.333%', right: '33.333%', borderLeft: line, borderRight: line }} />
      <div style={{ position: 'absolute', left: 0, right: 0, top: '33.333%', bottom: '33.333%', borderTop: line, borderBottom: line }} />
    </div>
  );
}