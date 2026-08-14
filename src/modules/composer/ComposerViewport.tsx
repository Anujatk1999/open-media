import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsType } from 'three-stdlib';
import { frameObject, getObjectBounds, setEditorView, type EditorView } from './cameraUtils';
import { useComposerStore, type ComposerTool } from '../../stores/composerStore';
import MannequinObject from './MannequinObject';
import type { MannequinHandle } from './MannequinObject';
import PrimitiveObject from './PrimitiveObject';
import type { PrimitiveHandle } from './PrimitiveObject';
import TransformGizmo from './TransformGizmo';
import WorkspaceToolbar from './WorkspaceToolbar';
import PoseControls from './PoseControls';
import JointGizmo from './JointGizmo';
import MotionPlayer from './MotionPlayer';
import { getJoint, getDOF, setDOF, JOINT_CONFIGS } from './helpers/jointConfig';
import { CompositionControls, CompositionController, type CompositionCommand, type CompositionDirection } from './CompositionControls';
import { removeMannequinCanvases } from './helpers/mannequinFactory';
import { readPosture } from './helpers/posture';

type WorkspaceApi = {
  view: (v: EditorView) => void;
  frame: () => void;
  reset: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
  fitAll: () => void;
  resetView: () => void;
  captureShot: () => void;
  setActiveTool: (tool: 'move' | 'rotate' | 'scale' | 'pose') => void;
};

export interface ComposerViewportAPI {
  setJoint: (mannequinId: string, configKey: string, dofIndex: number, value: number) => void;
  getJointValues: (mannequinId: string) => Record<string, number>;
  setCameraView: (view: EditorView) => void;
  resetCamera: () => void;
  captureShot: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
  setActiveTool: (tool: 'move' | 'rotate' | 'scale' | 'pose') => void;
}

const workspaceAPIRef: { current: ComposerViewportAPI | null } = { current: null };

/**
 * Right- and middle-drag both pan; the wheel already dollies, so a middle-drag
 * dolly would be a third way to do the same thing. Shift/Ctrl/Cmd + left-drag
 * pans as well — OrbitControls handles that modifier itself.
 *
 * One shared object, not a fresh literal per render: composition mode flips
 * LEFT to PAN in place, and drei would apply a new object straight back over it.
 */
const MOUSE_BUTTONS = {
  LEFT: THREE.MOUSE.ROTATE,
  RIGHT: THREE.MOUSE.PAN,
  MIDDLE: THREE.MOUSE.PAN,
};

/** Shared for the same reason as MOUSE_BUTTONS. */
const TOUCHES = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };

/**
 * Canvas setup, hoisted for the same reason again — and this one reaches further.
 *
 * `<Canvas>`'s setup effect carries no dependency array, so it re-runs R3F's
 * `configure()` after *every* re-render, and `configure` re-applies whichever of
 * these is not referentially equal to the object it saw last — writing straight
 * into the live renderer. Fresh literals meant a re-render was never free: it
 * reconfigured the renderer that the viewport's own input handling hangs off.
 */
const CAMERA_CONFIG = { fov: 42, near: 0.02, far: 1000, position: [6, 4, 8] as [number, number, number] };
const GL_CONFIG = { preserveDrawingBuffer: true };
const DPR: [number, number] = [1, 2];

/**
 * The zoom readout owns its own state so a camera move cannot re-render `<Canvas>`.
 *
 * OrbitControls fires `change` once per frame while damping settles, and the
 * percentage used to be state on the component that renders `<Canvas>` — so every
 * one of those frames reconfigured the renderer and reconciled the whole scene
 * subtree, from a plain camera nudge. The publisher is module-level, and so
 * stable, which also keeps it out of the effect deps that subscribe to `change`.
 */
let publishZoomPercent: ((pct: number) => void) | null = null;
const onZoomPercent = (pct: number) => publishZoomPercent?.(pct);

function ZoomReadout() {
  const [pct, setPct] = useState(100);
  useEffect(() => {
    publishZoomPercent = setPct;
    return () => { publishZoomPercent = null; };
  }, []);
  return <span>Zoom <b>{pct}%</b></span>;
}

export const ComposerViewport = forwardRef<ComposerViewportAPI>(function ComposerViewport(_props, ref) {
  const [api, setApi] = useState<WorkspaceApi | null>(null);
  const [grid, setGrid] = useState(true);
  const [axes, setAxes] = useState(false);
  const [compositionMode, setCompositionMode] = useState(false);
  const [compositionCommand, setCompositionCommand] = useState<CompositionCommand | null>(null);
  const undo = useComposerStore(s => s.undo);
  const canUndo = useComposerStore(s => s.history.length > 0);

  // Cleanup mannequin-js canvases on unmount
  useEffect(() => {
    return () => {
      removeMannequinCanvases();
    };
  }, []);

  /**
   * Tool shortcuts: C/M/R/S/P. Each drives the exact setter its toolbar button
   * drives — the store for the four tools, `compositionMode` for C, which is a
   * toggle here because the Composition button is one too. So every toolbar's
   * active highlight follows with no extra wiring.
   *
   * Modified presses are ignored, which is what leaves Ctrl+`+` / Ctrl+`-` alone,
   * and `e.repeat` stops a held C from strobing composition mode.
   */
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;

      const el = e.target as HTMLElement | null;
      if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;

      switch (e.key.toLowerCase()) {
        case 'c': setCompositionMode(v => !v); break;
        case 'm': useComposerStore.getState().setActiveTool('move'); break;
        case 'r': useComposerStore.getState().setActiveTool('rotate'); break;
        case 's': useComposerStore.getState().setActiveTool('scale'); break;
        case 'p': useComposerStore.getState().setActiveTool('pose'); break;
        default: return;
      }
      e.preventDefault();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const handleCompositionMove = useCallback((direction: CompositionDirection) => {
    setCompositionCommand({ direction, timestamp: Date.now() });
  }, []);

  const handleCommandConsumed = useCallback(() => {
    setCompositionCommand(null);
  }, []);

  useImperativeHandle(ref, () => ({
    setJoint(...args: Parameters<ComposerViewportAPI['setJoint']>) {
      workspaceAPIRef.current?.setJoint(...args);
    },
    getJointValues(...args: Parameters<ComposerViewportAPI['getJointValues']>) {
      return workspaceAPIRef.current?.getJointValues(...args) ?? {};
    },
    setCameraView: (view: EditorView) => api?.view?.(view),
    resetCamera: () => api?.resetView?.(),
    captureShot: () => api?.captureShot?.(),
    zoomIn: () => api?.zoomIn?.(),
    zoomOut: () => api?.zoomOut?.(),
    setActiveTool: (tool: ComposerTool) => {
      useComposerStore.getState().setActiveTool(tool);
    },
  }), [api]);

  return (
    <div className="composer-viewport">
      <Canvas
        className="composer-canvas"
        dpr={DPR}
        camera={CAMERA_CONFIG}
        gl={GL_CONFIG}
      >
        <WorkspaceWithAPI grid={grid} axes={axes} ready={setApi} onZoomChange={onZoomPercent} />
        <CompositionController
          enabled={compositionMode}
          command={compositionCommand}
          onCommandConsumed={handleCommandConsumed}
        />
      </Canvas>
      <div className="workspace-toolbar">
        <WorkspaceToolbar />
        <button onClick={undo} disabled={!canUndo} title="Undo last scene change">
          Undo
        </button>
        <ZoomReadout />
        <button type="button" onClick={() => api?.zoomIn()} title="Zoom In">+</button>
        <button type="button" onClick={() => api?.zoomOut()} title="Zoom Out">-</button>
        <button onClick={() => api?.frame()}>Frame Selected</button>
        <button onClick={() => api?.resetView()}>Reset View</button>
        <button className={grid ? 'on' : ''} onClick={() => setGrid(v => !v)}>Grid</button>
        <button className={compositionMode ? 'on' : ''} onClick={() => setCompositionMode(v => !v)} title="Composition Mode">
          Composition
        </button>
      </div>
      <button className="capture-shot-btn" onClick={() => api?.captureShot()} title="Capture Shot (PNG)">
        Capture Shot
      </button>
      <CompositionControls enabled={compositionMode} onMove={handleCompositionMove} />
    </div>
  );
});

function WorkspaceWithAPI(props: { grid: boolean; axes: boolean; ready: (api: WorkspaceApi) => void; onZoomChange?: (pct: number) => void }) {
  const updatePosture = useComposerStore(s => s.updateObjectPosture);
  const localMannequinRefs = useRef<Map<string, MannequinHandle>>(new Map());
  const localPrimitiveRefs = useRef<Map<string, PrimitiveHandle>>(new Map());
  const workspaceRef = useRef<{ setCameraView: (view: EditorView) => void; resetCamera: () => void } | null>(null);
  const glRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.Camera | null>(null);

  const api = useMemo((): ComposerViewportAPI => ({
    setJoint(mannequinId, configKey, dofIndex, value) {
      const handle = localMannequinRefs.current.get(mannequinId);
      if (!handle?.mannequin) return;
      const m = handle.mannequin as any;
      const joint = getJoint(m, configKey);
      if (!joint) return;
      const config = JOINT_CONFIGS.find(c => c.mannequinKey === configKey);
      if (!config) return;
      const dof = config.dofs[dofIndex];
      if (!dof) return;
      setDOF(joint, dof, value);
      m.updateMatrixWorld(true);
      updatePosture(mannequinId, readPosture(m));
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
            result[`${config.mannequinKey}:${idx}`] = getDOF(joint, dof);
          } catch {
            result[`${config.mannequinKey}:${idx}`] = 0;
          }
        });
      }
      return result;
    },
    setCameraView(view: EditorView) {
      workspaceRef.current?.setCameraView(view);
    },
    resetCamera() {
      workspaceRef.current?.resetCamera();
    },
    captureShot() {
      if (glRef.current && sceneRef.current && cameraRef.current) {
        const renderer = glRef.current;
        renderer.render(sceneRef.current, cameraRef.current);
        renderer.domElement.toBlob((blob: Blob | null) => {
          if (!blob) return;
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          const now = new Date();
          const timestamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;
          link.download = `shot-${timestamp}.png`;
          link.href = url;
          link.click();
          URL.revokeObjectURL(url);
        }, 'image/png');
      }
    },
    zoomIn() {
      // This will be called via the api in useLayoutEffect
      // We'll need to access the api from the Workspace
    },
    zoomOut() {
      // Same as above
    },
    setActiveTool(tool: 'move' | 'rotate' | 'scale' | 'pose') {
      useComposerStore.getState().setActiveTool(tool);
    },
  }), [updatePosture]);

  workspaceAPIRef.current = api;

  return <Workspace grid={props.grid} axes={props.axes} ready={props.ready} mannequinRefs={localMannequinRefs} primitiveRefs={localPrimitiveRefs} onZoomChange={props.onZoomChange} workspaceRef={workspaceRef} glRef={glRef} sceneRef={sceneRef} cameraRef={cameraRef} />;
}

function Workspace({
  grid,
  axes,
  ready,
  mannequinRefs,
  primitiveRefs,
  onZoomChange,
  workspaceRef,
  glRef,
  sceneRef,
  cameraRef,
}: {
  grid: boolean;
  axes: boolean;
  ready: (api: WorkspaceApi) => void;
  mannequinRefs: React.MutableRefObject<Map<string, MannequinHandle>>;
  primitiveRefs: React.MutableRefObject<Map<string, PrimitiveHandle>>;
  onZoomChange?: (pct: number) => void;
  workspaceRef: React.MutableRefObject<{ setCameraView: (view: EditorView) => void; resetCamera: () => void } | null>;
  glRef: React.MutableRefObject<THREE.WebGLRenderer | null>;
  sceneRef: React.MutableRefObject<THREE.Scene | null>;
  cameraRef: React.MutableRefObject<THREE.Camera | null>;
}) {
  const { camera, gl, scene } = useThree();

  // Populate the refs with actual Three.js objects from R3F context
  useEffect(() => {
    glRef.current = gl;
    sceneRef.current = scene;
    cameraRef.current = camera;
  }, [gl, scene, camera]);
  // useState + callback ref ensures useLayoutEffect fires after controls mount.
  const [controls, setControls] = useState<OrbitControlsType | null>(null);
  const objects = useComposerStore(s => s.objects);
  const selectedId = useComposerStore(s => s.selectedObjectId);
  const selectObject = useComposerStore(s => s.selectObject);
  const clearSelection = useComposerStore(s => s.clearSelection);
  const activeTool = useComposerStore(s => s.activeTool);

  // Track Object3D roots keyed by object id so we can frame selected.
  const rootsRef = useRef<Map<string, THREE.Object3D>>(new Map());

  // Track the currently selected root so framing callbacks don't capture stale closures.
  const selectedRootRef = useRef<THREE.Object3D | null>(null);

  // Objects already framed once, so selecting one later never yanks the camera.
  const framedIds = useRef(new Set<string>());

  /**
   * Puts a newly added object on screen at a usable size, seen head-on.
   *
   * The direction is the same one the Front preset uses. `frameObject`'s default
   * is the 3/4 view (1, .55, 1), which reads as tilted and sideways on a figure:
   * mannequin-js bakes `body.turn = -90` into every default posture so the figure
   * faces +Z, which is exactly where the prototype parks its own camera
   * (`scene.js:60`, `position.set(0, 0, 5)`). Only the camera moves — the
   * object's own transform and posture are untouched.
   */
  const frameNewObject = (id: string) => {
    if (!controls || framedIds.current.has(id)) return;
    const root = rootsRef.current.get(id);
    if (!root) return;
    root.updateWorldMatrix(true, true);
    if (getObjectBounds(root).isEmpty()) return; // a mannequin still importing
    framedIds.current.add(id);
    frameObject(camera as THREE.PerspectiveCamera, controls, root, new THREE.Vector3(0, 0.08, 1));
  };

  // A mannequin is built from a dynamic import, so its wrapper has no bounds to
  // measure until that resolves — hence the second attempt on ready. The ref
  // keeps the callback identity stable: MannequinObject rebuilds its figure
  // whenever `onReady` changes.
  const frameOnReady = useRef<() => void>(() => {});
  frameOnReady.current = () => { if (selectedId) frameNewObject(selectedId); };
  const handleMannequinReady = useCallback(() => frameOnReady.current(), []);

  /**
   * The gizmo target, resolved in an effect rather than in render.
   *
   * `rootsRef` is filled by the children's callback refs, which React attaches
   * during commit — after the render phase has already run. Deriving `target`
   * with `useMemo` therefore missed a newly added object every time: on the render
   * where it first appears the Map has no entry yet, so `target` was null, and
   * nothing re-rendered afterwards because a Map mutation is invisible to React.
   * The gizmo stayed absent until some unrelated state change recomputed it —
   * which is what "works only after focus leaves the viewport" was.
   *
   * Effects run after refs are attached, so the Map is populated by now. Keying on
   * `objects` covers add and delete. Re-setting the same value is a no-op, so this
   * cannot loop. `setTarget` is deliberately not called from the ref callbacks:
   * those are inline arrows, so React re-runs them on every commit, and a setState
   * there would never settle.
   */
  const [target, setTarget] = useState<THREE.Object3D | null>(null);
  useEffect(() => {
    setTarget(selectedId ? rootsRef.current.get(selectedId) ?? null : null);
  }, [selectedId, objects]);

  // Objects restored with the scene are not new, so they must never pull the
  // camera the first time they are clicked.
  useEffect(() => {
    for (const obj of useComposerStore.getState().objects) framedIds.current.add(obj.id);
  }, []);

  // Adding an object selects it, so this covers primitives, which mount with
  // their geometry already measurable. Mannequins arrive empty and are caught
  // by onReady instead.
  useEffect(() => {
    if (selectedId) frameNewObject(selectedId);
  }, [selectedId, objects, controls]);

  // Keep selectedRootRef in sync with selection changes.
  useEffect(() => {
    selectedRootRef.current = selectedId ? rootsRef.current.get(selectedId) ?? null : null;
  }, [selectedId, objects]);

  // Initialize workspaceRef with camera control functions
  useEffect(() => {
    if (!workspaceRef.current) return;
    workspaceRef.current.setCameraView = (view: EditorView) => {
      const r = selectedRootRef.current;
      if (r && controls) {
        setEditorView(camera as THREE.PerspectiveCamera, controls, r, view);
      }
    };
    workspaceRef.current.resetCamera = () => {
      const r = selectedRootRef.current;
      if (controls) {
        if (r) {
          frameObject(camera as THREE.PerspectiveCamera, controls, r);
        } else {
          controls.target.set(0, 0.85, 0);
          (camera as THREE.PerspectiveCamera).position.set(6, 4, 8);
          (camera as THREE.PerspectiveCamera).lookAt(0, 0.85, 0);
          controls.update();
        }
      }
    };
  }, [camera, controls, selectedRootRef, workspaceRef]);

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
      captureShot: () => {
        if (glRef.current && sceneRef.current && cameraRef.current) {
          const renderer = glRef.current;
          renderer.render(sceneRef.current, cameraRef.current);
          renderer.domElement.toBlob((blob: Blob | null) => {
            if (!blob) return;
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            const now = new Date();
            const timestamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;
            link.download = `shot-${timestamp}.png`;
            link.href = url;
            link.click();
            URL.revokeObjectURL(url);
          }, 'image/png');
        }
      },
      setActiveTool: (tool: 'move' | 'rotate' | 'scale' | 'pose') => {
        useComposerStore.getState().setActiveTool(tool);
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

      {/* Click empty space to deselect. Unmounted in pose mode: the plane spans
          the whole ground and would swallow joint picks — PoseControls does its
          own clearing there. Mirrors the prototype's `else if (!moveMode)`. */}
      {activeTool !== "pose" && (
        <mesh
          visible={false}
          position={[0, -0.001, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          onClick={(e) => {
            e.stopPropagation();
            if (e.delta > 2) return; // a camera drag that ended on the ground, not a click
            clearSelection();
          }}
        >
          <planeGeometry args={[1000, 1000]} />
          <meshBasicMaterial transparent opacity={0} />
        </mesh>
      )}

      {objects.map((obj) => {
        const isPrimitive = ["cube", "plane", "cylinder", "sphere", "capsule", "cone", "torus"].includes(obj.type);

        if (isPrimitive) {
          return (
            <PrimitiveObject
              key={obj.id}
              ref={(handle: PrimitiveHandle | null) => {
                if (handle) {
                  primitiveRefs.current.set(obj.id, handle);
                  rootsRef.current.set(obj.id, handle.root);
                } else {
                  primitiveRefs.current.delete(obj.id);
                  rootsRef.current.delete(obj.id);
                }
              }}
              id={obj.id}
              type={obj.type as "cube" | "plane" | "cylinder" | "sphere" | "capsule" | "cone" | "torus"}
              name={obj.name}
              position={obj.transform.position}
              rotation={obj.transform.rotation}
              scale={obj.transform.scale}
              visible={obj.visible}
              selected={obj.id === selectedId}
              onSelect={selectObject}
            />
          );
        } else {
          return (
            <MannequinObject
              key={obj.id}
              ref={(handle: MannequinHandle | null) => {
                if (handle) {
                  mannequinRefs.current.set(obj.id, handle);
                  rootsRef.current.set(obj.id, handle.root);
                } else {
                  mannequinRefs.current.delete(obj.id);
                  rootsRef.current.delete(obj.id);
                }
              }}
              id={obj.id}
              type={obj.type as "male" | "female" | "child"}
              name={obj.name}
              position={obj.transform.position}
              rotation={obj.transform.rotation}
              posture={obj.posture}
              visible={obj.visible}
              selected={obj.id === selectedId}
              onReady={handleMannequinReady}
              onSelect={selectObject}
            />
          );
        }
      })}

      <PoseControls />
      <JointGizmo />
      <MotionPlayer />
      <TransformGizmo target={target} />

      <OrbitControls
        ref={(el: OrbitControlsType | null) => { if (el && el !== controls) setControls(el); }}
        enableDamping
        dampingFactor={0.08}
        enablePan
        enableRotate
        enableZoom
        minDistance={0.1}
        maxDistance={Infinity}
        // Dollying towards the pointer walks the orbit target with it, so the
        // view is no longer pinned to the object's centre: zoom onto a face or a
        // hand and orbit/pan from there. 0.5 stopped short of a head-fill shot
        // (a head is ~0.25 units, so ~0.33 away at fov 42).
        zoomToCursor
        // Pan along the frame's own right/up rather than the ground plane, so
        // "up" is up in the shot at any camera angle.
        screenSpacePanning
        panSpeed={1}
        mouseButtons={MOUSE_BUTTONS}
        touches={TOUCHES}
      />
    </>
  );
}
