import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsType } from 'three-stdlib';
import { frameObject, getObjectBounds, setEditorView, type EditorView } from './cameraUtils';
import { useComposerStore } from '../../stores/composerStore';
import MannequinObject from './MannequinObject';
import TransformGizmo from './TransformGizmo';
import WorkspaceToolbar from './WorkspaceToolbar';

type WorkspaceApi = {
  view: (v: EditorView) => void;
  frame: () => void;
  reset: () => void;
};

export function ComposerViewport() {
  const [api, setApi] = useState<WorkspaceApi | null>(null);
  const [grid, setGrid] = useState(true);
  const [axes, setAxes] = useState(false);

  return (
    <div className="composer-viewport">
      <Canvas
        className="composer-canvas"
        dpr={[1, 2]}
        camera={{ fov: 42, near: 0.1, far: 1000 }}
      >
        <Workspace grid={grid} axes={axes} ready={setApi} />
      </Canvas>
      <div className="workspace-toolbar">
        <WorkspaceToolbar />
        <i/>
        <span>Orbit <b>Left drag</b></span>
        <span>Pan <b>Right drag</b></span>
        <span>Zoom <b>Wheel</b></span>
        <i/>
        <button onClick={() => api?.view('front')}>Front</button>
        <button onClick={() => api?.view('side')}>Side</button>
        <button onClick={() => api?.view('top')}>Top</button>
        <button onClick={() => api?.view('perspective')}>Perspective</button>
        <button onClick={() => api?.frame()}>Frame Selected</button>
        <button onClick={() => api?.reset()}>Reset View</button>
        <button className={grid ? 'on' : ''} onClick={() => setGrid(v => !v)}>Grid</button>
        <button className={axes ? 'on' : ''} onClick={() => setAxes(v => !v)}>Axes</button>
      </div>
    </div>
  );
}

function Workspace({
  grid,
  axes,
  ready,
}: {
  grid: boolean;
  axes: boolean;
  ready: (api: WorkspaceApi) => void;
}) {
  const { camera } = useThree();
  const controls = useRef<OrbitControlsType>(null);
  const mannequins = useComposerStore(s => s.mannequins);
  const selectedId = useComposerStore(s => s.selectedMannequinId);
  const selectMannequin = useComposerStore(s => s.selectMannequin);
  const clearSelection = useComposerStore(s => s.clearSelection);

  // Track Object3D roots keyed by mannequin id so we can frame selected.
  const rootsRef = useRef<Map<string, THREE.Object3D>>(new Map());

  // Initial framing once the first mannequin is ready.
  const [didInitialFrame, setDidInitialFrame] = useState(false);

  const target = useMemo(() => {
    if (selectedId) {
      return rootsRef.current.get(selectedId) ?? null;
    }
    return null;
  }, [selectedId, mannequins]);

  useLayoutEffect(() => {
    const c = camera as THREE.PerspectiveCamera;
    const ctl = controls.current;
    if (!ctl) return;

    const frameTarget = target ?? rootsRef.current.values().next().value ?? null;

    const setup = () => {
      if (frameTarget) {
        frameObject(c, ctl, frameTarget);
      }
    };

    ready({
      view: (v) => {
        if (frameTarget) setEditorView(c, ctl, frameTarget, v);
      },
      frame: setup,
      reset: setup,
    });

    if (!didInitialFrame && frameTarget) {
      setup();
      setDidInitialFrame(true);
    }
  }, [camera, ready, target, didInitialFrame]);

  // Re-frame when selection changes if there's a selected target.
  useEffect(() => {
    if (!target) return;
    const c = camera as THREE.PerspectiveCamera;
    const ctl = controls.current;
    if (!ctl) return;
    // Only auto-frame on first selection, not every click — keeps user's orbit.
  }, [target]);

  // Wire OrbitControls so TransformGizmo can disable them while dragging
  useEffect(() => {
    if (controls.current) {
      (camera as any).__orbitControls = controls.current;
    }
  }, [camera, controls.current]);

  return (
    <>
      <color attach="background" args={['#15191d']} />
      <ambientLight intensity={1.4} />
      <directionalLight position={[5, 8, 6]} intensity={2.1} />
      <directionalLight position={[-4, 3, -5]} intensity={0.5} />

      {grid && <gridHelper args={[30, 30, '#3c464b', '#242c30']} />}
      {axes && <axesHelper args={[1.4]} />}

      {/* Click empty space to deselect */}
      <mesh
        visible={false}
        position={[0, -0.001, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        onClick={(e) => {
          e.stopPropagation();
          clearSelection();
        }}
      >
        <planeGeometry args={[1000, 1000]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>

      {mannequins.map((m) => (
        <MannequinObject
          key={m.id}
          id={m.id}
          type={m.type}
          name={m.name}
          position={m.transform.position}
          rotation={m.transform.rotation}
          visible={m.visible}
          selected={m.id === selectedId}
          onReady={(obj) => {
            rootsRef.current.set(m.id, obj);
          }}
          onSelect={selectMannequin}
        />
      ))}

      <TransformGizmo target={target} />

      <OrbitControls
        ref={controls}
        enableDamping
        dampingFactor={0.08}
        enablePan
        enableRotate
        enableZoom
        minDistance={1}
        maxDistance={40}
        mouseButtons={{
          LEFT: THREE.MOUSE.ROTATE,
          RIGHT: THREE.MOUSE.PAN,
          MIDDLE: THREE.MOUSE.DOLLY,
        }}
      />
    </>
  );
}
