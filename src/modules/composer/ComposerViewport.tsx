import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsType } from 'three-stdlib';
import { frameObject, getObjectBounds, setEditorView, type EditorView } from './cameraUtils';
import { useComposerStore } from '../../stores/composerStore';
import MannequinObject from './MannequinObject';
import type { MannequinHandle } from './MannequinObject';
import TransformGizmo from './TransformGizmo';
import WorkspaceToolbar from './WorkspaceToolbar';
import { getJoint, setDOF, JOINT_CONFIGS } from './helpers/jointConfig';

type WorkspaceApi = {
  view: (v: EditorView) => void;
  frame: () => void;
  reset: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
  fitAll: () => void;
  resetView: () => void;
};

export interface ComposerViewportAPI {
  setJoint: (mannequinId: string, configKey: string, dofIndex: number, value: number) => void;
  getJointValues: (mannequinId: string) => Record<string, number>;
}

const workspaceAPIRef: { current: ComposerViewportAPI | null } = { current: null };

export const ComposerViewport = forwardRef<ComposerViewportAPI>(function ComposerViewport(_props, ref) {
  const [api, setApi] = useState<WorkspaceApi | null>(null);
  const [grid, setGrid] = useState(true);
  const [axes, setAxes] = useState(false);
  const [zoomPercent, setZoomPercent] = useState(100);

  useImperativeHandle(ref, () => ({
    setJoint(...args: Parameters<ComposerViewportAPI['setJoint']>) {
      workspaceAPIRef.current?.setJoint(...args);
    },
    getJointValues(...args: Parameters<ComposerViewportAPI['getJointValues']>) {
      return workspaceAPIRef.current?.getJointValues(...args) ?? {};
    },
  }), []);

  return (
    <div className="composer-viewport">
      <Canvas
        className="composer-canvas"
        dpr={[1, 2]}
        camera={{ fov: 42, near: 0.1, far: 1000, position: [6, 4, 8] }}
      >
        <WorkspaceWithAPI grid={grid} axes={axes} ready={setApi} onZoomChange={setZoomPercent} />
      </Canvas>
      <div className="workspace-toolbar">
        <WorkspaceToolbar />
        <i/>
        <span>Zoom <b>{zoomPercent}%</b></span>
        <button onClick={() => api?.zoomIn()} title="Zoom In">+</button>
        <button onClick={() => api?.zoomOut()} title="Zoom Out">-</button>
        <i/>
        <button onClick={() => api?.fitAll()}>Fit All</button>
        <button onClick={() => api?.resetView()}>Reset View</button>
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
        <button className={grid ? 'on' : ''} onClick={() => setGrid(v => !v)}>Grid</button>
        <button className={axes ? 'on' : ''} onClick={() => setAxes(v => !v)}>Axes</button>
      </div>
    </div>
  );
});

function WorkspaceWithAPI(props: { grid: boolean; axes: boolean; ready: (api: WorkspaceApi) => void; onZoomChange?: (pct: number) => void }) {
  const updatePosture = useComposerStore(s => s.updateMannequinPosture);
  const localMannequinRefs = useRef<Map<string, MannequinHandle>>(new Map());

  const api = useMemo((): ComposerViewportAPI => ({
    setJoint(mannequinId, configKey, dofIndex, value) {
      const handle = localMannequinRefs.current.get(mannequinId);
      if (!handle?.mannequin) return;
      const m = handle.mannequin as any;
      const joint = getJoint(m, configKey);
      if (!joint) return;
      const config = JOINT_CONFIGS.find(c => c.mannequinKey === configKey);
      if (!config) return;
      const accessor = config.dofs[dofIndex]?.accessor;
      if (!accessor) return;
      setDOF(joint, accessor, value);
      m.updateMatrixWorld(true);
      if (typeof m.stepOnGround === "function") m.stepOnGround();
      const posture = m.posture;
      if (posture) updatePosture(mannequinId, posture);
    },
    getJointValues(mannequinId) {
      const handle = localMannequinRefs.current.get(mannequinId);
      if (!handle?.mannequin) return {};
      const m = handle.mannequin as any;
      const result: Record<string, number> = {};
      for (const config of JOINT_CONFIGS) {
        const joint = getJoint(m, config.mannequinKey);
        if (!joint) continue;
        config.dofs.forEach((dof, idx) => {
          try {
            result[`${config.mannequinKey}:${idx}`] = joint[dof.accessor];
          } catch {
            result[`${config.mannequinKey}:${idx}`] = 0;
          }
        });
      }
      return result;
    },
  }), [updatePosture]);

  workspaceAPIRef.current = api;

  return <Workspace grid={props.grid} axes={props.axes} ready={props.ready} mannequinRefs={localMannequinRefs} onZoomChange={props.onZoomChange} />;
}

function Workspace({
  grid,
  axes,
  ready,
  mannequinRefs,
  onZoomChange,
}: {
  grid: boolean;
  axes: boolean;
  ready: (api: WorkspaceApi) => void;
  mannequinRefs: React.MutableRefObject<Map<string, MannequinHandle>>;
  onZoomChange?: (pct: number) => void;
}) {
  const { camera } = useThree();
  // useState + callback ref ensures useLayoutEffect fires after controls mount.
  const [controls, setControls] = useState<OrbitControlsType | null>(null);
  const mannequins = useComposerStore(s => s.mannequins);
  const selectedId = useComposerStore(s => s.selectedMannequinId);
  const selectMannequin = useComposerStore(s => s.selectMannequin);
  const clearSelection = useComposerStore(s => s.clearSelection);

  // Track Object3D roots keyed by mannequin id so we can frame selected.
  const rootsRef = useRef<Map<string, THREE.Object3D>>(new Map());

  // Track the currently selected root so framing callbacks don't capture stale closures.
  const selectedRootRef = useRef<THREE.Object3D | null>(null);

  const target = useMemo(() => {
    if (selectedId) {
      return rootsRef.current.get(selectedId) ?? null;
    }
    return null;
  }, [selectedId]);

  // Keep selectedRootRef in sync with selection changes.
  useEffect(() => {
    selectedRootRef.current = selectedId ? rootsRef.current.get(selectedId) ?? null : null;
  }, [selectedId, mannequins]);

  useLayoutEffect(() => {
    const c = camera as THREE.PerspectiveCamera;
    if (!controls) return;

    // Set camera target to mannequin center height so the scene is centered
    // with equal space above and below. Must call update() immediately so
    // OrbitControls internal state matches — without it the camera still
    // looks at the default (0,0,0) ground level.
    controls.target.set(0, 0.85, 0);
    c.lookAt(0, 0.85, 0);
    controls.update();

    ready({
      view: (v) => {
        const r = selectedRootRef.current;
        if (r) setEditorView(c, controls, r, v);
      },
      frame: () => {
        const r = selectedRootRef.current;
        if (r) frameObject(c, controls, r);
      },
      reset: () => {
        controls.target.set(0, 0.85, 0);
        c.position.set(6, 4, 8);
        c.lookAt(0, 0.85, 0);
        controls.update();
      },
      zoomIn: () => {
        const dir = new THREE.Vector3().copy(c.position).sub(controls.target);
        dir.multiplyScalar(0.8);
        c.position.copy(controls.target).add(dir);
        controls.update();
      },
      zoomOut: () => {
        const dir = new THREE.Vector3().copy(c.position).sub(controls.target);
        dir.multiplyScalar(1.25);
        c.position.copy(controls.target).add(dir);
        controls.update();
      },
      fitAll: () => {
        const r = selectedRootRef.current;
        if (r) frameObject(c, controls, r);
      },
      resetView: () => {
        controls.target.set(0, 0.85, 0);
        c.position.set(6, 4, 8);
        c.lookAt(0, 0.85, 0);
        controls.update();
      },
    });
  }, [camera, controls]);

  // Track zoom percentage for toolbar display
  useEffect(() => {
    if (!controls || !onZoomChange) return;
    const update = () => {
      const dist = controls.object.position.distanceTo(controls.target);
      const pct = Math.round(Math.max(10, Math.min(300, 300 - ((dist - 1) / 99) * 285)));
      onZoomChange(pct);
    };
    update();
    controls.addEventListener('change', update);
    return () => controls.removeEventListener('change', update);
  }, [controls, onZoomChange]);

  // Wire OrbitControls so TransformGizmo can disable them while dragging
  useEffect(() => {
    if (controls) {
      (camera as any).__orbitControls = controls;
    }
  }, [camera, controls]);

  return (
    <>
      <color attach="background" args={['#15191d']} />
      <ambientLight intensity={1.4} />
      <directionalLight position={[5, 8, 6]} intensity={2.1} />
      <directionalLight position={[-4, 3, -5]} intensity={0.5} />

      {grid && <gridHelper args={[100, 100, '#3c464b', '#242c30']} />}
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
          ref={(handle: MannequinHandle | null) => {
            if (handle) {
              mannequinRefs.current.set(m.id, handle);
              rootsRef.current.set(m.id, handle.root);
            } else {
              mannequinRefs.current.delete(m.id);
              rootsRef.current.delete(m.id);
            }
          }}
          id={m.id}
          type={m.type}
          name={m.name}
          position={m.transform.position}
          rotation={m.transform.rotation}
          posture={m.posture}
          visible={m.visible}
          selected={m.id === selectedId}
          onSelect={selectMannequin}
        />
      ))}

      <TransformGizmo target={target} />

      <OrbitControls
        ref={(el: OrbitControlsType | null) => { if (el && el !== controls) setControls(el); }}
        enableDamping
        dampingFactor={0.08}
        enablePan
        enableRotate
        enableZoom
        minDistance={0.5}
        maxDistance={Infinity}
        mouseButtons={{
          LEFT: THREE.MOUSE.ROTATE,
          RIGHT: THREE.MOUSE.PAN,
          MIDDLE: THREE.MOUSE.DOLLY,
        }}
      />
    </>
  );
}
