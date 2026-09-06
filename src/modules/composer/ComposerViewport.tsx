import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { flushSync } from 'react-dom';
import { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsType } from 'three-stdlib';
import { frameObject, getObjectBounds, setEditorView, type EditorView } from './cameraUtils';
import { useComposerStore, type ComposerTool, type SceneObject } from '../../stores/composerStore';
import { sampleTrack } from '../motion/helpers/sampleTrack';
import { writePosture, type Posture } from './helpers/posture';
import MannequinObject from './MannequinObject';
import PrimitiveObject from './PrimitiveObject';
import CameraObject from '../motion/CameraObject';
import TransformGizmo from './TransformGizmo';
import WorkspaceToolbar from './WorkspaceToolbar';
import PoseControls from './PoseControls';
import JointGizmo from './JointGizmo';
import { CompositionControls, CompositionController, type CompositionCommand, type CompositionDirection } from './CompositionControls';
import { removeMannequinCanvases } from './helpers/mannequinFactory';
import { getCharacterAnchors, solveShot, type CharacterAnchors, type ShotParams } from '../library/calibration/shotSolver';

export type ComposerMode = 'static' | 'motion';

type WorkspaceApi = {
  view: (v: EditorView) => void;
  frame: () => void;
  reset: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
  fitAll: () => void;
  resetView: () => void;
  captureShot: () => void;
  exportVideo: (onProgress?: (fraction: number) => void) => Promise<void>;
  setActiveTool: (tool: ComposerTool) => void;
  applyShot: (params: ShotParams) => void;
  getScene: () => THREE.Scene | null;
  getCamera: () => THREE.Camera | null;
};

export interface ComposerViewportAPI {
  setCameraView: (view: EditorView) => void;
  resetCamera: () => void;
  captureShot: () => void;
  exportVideo: (onProgress?: (fraction: number) => void) => Promise<void>;
  zoomIn: () => void;
  zoomOut: () => void;
  setActiveTool: (tool: ComposerTool) => void;
  /** Solves the shot camera for the currently selected object and applies it directly to the main viewport camera — the same camera Move/Rotate/Scale/Pose then edit freely. No-op when nothing is selected. */
  applyShot: (params: ShotParams) => void;
  /** The live scene backing the main viewport, so the Shot Preview renders the same content through its own camera. */
  getScene: () => THREE.Scene | null;
  /** The live main-viewport camera, so the Shot Preview can mirror its exact pose every frame instead of keeping independent camera state. */
  getCamera: () => THREE.Camera | null;
}

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

const PRIMITIVE_TYPES = ["cube", "plane", "cylinder", "sphere", "capsule", "cone", "torus"];
const IDENTITY: [number, number, number] = [0, 0, 0];
const IDENTITY_SCALE: [number, number, number] = [1, 1, 1];

/**
 * Priority order for MediaRecorder output: real MP4/H.264 first — confirmed
 * supported via `MediaRecorder.isTypeSupported` in this project's target
 * browsers, so this is not a hopeful fallback chain, it's expected to hit the
 * first entry — then WebM as the safety net on browsers that lack it.
 */
const VIDEO_MIME_CANDIDATES = [
  { mime: "video/mp4;codecs=avc1.42E01E", ext: "mp4" },
  { mime: "video/mp4", ext: "mp4" },
  { mime: "video/webm;codecs=vp9", ext: "webm" },
  { mime: "video/webm", ext: "webm" },
];

function pickVideoMimeType() {
  for (const candidate of VIDEO_MIME_CANDIDATES) {
    if (MediaRecorder.isTypeSupported(candidate.mime)) return candidate;
  }
  return VIDEO_MIME_CANDIDATES[VIDEO_MIME_CANDIDATES.length - 1];
}

const EXPORT_WIDTH = 1280;

/**
 * Drives the real `PlaybackDriver`/`setPlaying` loop from t=0 to completion
 * while recording, so the exported video is sampled through the exact same
 * interpolation path as normal on-screen playback rather than a separate
 * offline render. Rendering happens on a brand new, never-mounted
 * WebGLRenderer/canvas pointed at the same `scene` graph — the interactive
 * viewport's own canvas/camera are never touched, so nothing needs to be
 * swapped back afterward there.
 */
function exportMotionVideo(
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera,
  controls: OrbitControlsType | null,
  onProgress?: (fraction: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const { mime, ext } = pickVideoMimeType();
    const wasLayer1Enabled = camera.layers.isEnabled(1);
    const wasOrbitEnabled = controls?.enabled ?? true;
    const previousAspect = camera.aspect;
    const previousSelectedId = useComposerStore.getState().selectedObjectId;

    camera.layers.disable(1);
    if (controls) controls.enabled = false;
    useComposerStore.getState().clearSelection();

    const width = EXPORT_WIDTH;
    const height = Math.round(width / camera.aspect);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();

    const canvas = document.createElement("canvas");
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
    renderer.setSize(width, height, false);

    let rafId = 0;
    function renderLoop() {
      renderer.render(scene, camera);
      rafId = requestAnimationFrame(renderLoop);
    }
    renderLoop();

    const stream = canvas.captureStream(30);
    const recorder = new MediaRecorder(stream, { mimeType: mime });
    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };

    let unsubscribe = () => {};
    function restore() {
      cancelAnimationFrame(rafId);
      renderer.dispose();
      if (wasLayer1Enabled) camera.layers.enable(1);
      if (controls) controls.enabled = wasOrbitEnabled;
      camera.aspect = previousAspect;
      camera.updateProjectionMatrix();
      if (previousSelectedId) useComposerStore.getState().selectObject(previousSelectedId);
      stream.getTracks().forEach((track) => track.stop());
      unsubscribe();
    }

    recorder.onstop = () => {
      restore();
      const blob = new Blob(chunks, { type: mime });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const now = new Date();
      const timestamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}${String(now.getSeconds()).padStart(2, "0")}`;
      link.download = `motion-export-${timestamp}.${ext}`;
      link.href = url;
      link.click();
      URL.revokeObjectURL(url);
      resolve();
    };
    recorder.onerror = (event) => {
      restore();
      reject(event);
    };

    let started = false;
    unsubscribe = useComposerStore.subscribe((state) => {
      const { elapsed, duration, playing } = state.playback;
      onProgress?.(duration > 0 ? Math.min(1, elapsed / duration) : 1);
      if (playing) started = true;
      if (started && !playing && recorder.state === "recording") recorder.stop();
    });

    useComposerStore.getState().setElapsed(0);
    recorder.start();
    useComposerStore.getState().setPlaying(true);
  });
}

export interface ComposerViewportProps {
  /** Fires once the workspace's imperative API (applyShot, getScene, getCamera, ...) is actually wired up — mirrors the Shot Builder's own onSceneReady pattern, since api starts out null for a render or two after mount. */
  onSceneReady?: () => void;
  /** The active shot framing, for "Save Scene" — the same value ShotBuilderPanel edits. */
  shotParams: ShotParams;
  mode: ComposerMode;
  /** Grid/Composition-guide display are controlled from the top action bar (ComposerShell) so their buttons live in one place rather than duplicating state. */
  grid: boolean;
  compositionMode: boolean;
  onToggleComposition: () => void;
}

export const ComposerViewport = forwardRef<ComposerViewportAPI, ComposerViewportProps>(function ComposerViewport({ onSceneReady, shotParams, mode, grid, compositionMode, onToggleComposition }, ref) {
  const [api, setApi] = useState<WorkspaceApi | null>(null);
  const [axes] = useState(false);
  const [compositionCommand, setCompositionCommand] = useState<CompositionCommand | null>(null);
  const [toolbarCollapsed, setToolbarCollapsed] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const selectedObjectId = useComposerStore(s => s.selectedObjectId);
  const activeTool = useComposerStore(s => s.activeTool);
  const setActiveTool = useComposerStore(s => s.setActiveTool);
  const commitLiveKeyframe = useComposerStore(s => s.commitLiveKeyframe);

  const handleExportVideo = useCallback(async () => {
    if (!api || exporting) return;
    setExporting(true);
    setExportProgress(0);
    try {
      await api.exportVideo(setExportProgress);
    } finally {
      setExporting(false);
    }
  }, [api, exporting]);

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
        case 'c': onToggleComposition(); break;
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
  }, [onToggleComposition]);

  const handleCompositionMove = useCallback((direction: CompositionDirection) => {
    setCompositionCommand({ direction, timestamp: Date.now() });
  }, []);

  const handleCommandConsumed = useCallback(() => {
    setCompositionCommand(null);
  }, []);

  useImperativeHandle(ref, () => ({
    setCameraView: (view: EditorView) => api?.view?.(view),
    resetCamera: () => api?.resetView?.(),
    captureShot: () => api?.captureShot?.(),
    exportVideo: (onProgress) => api?.exportVideo?.(onProgress) ?? Promise.resolve(),
    zoomIn: () => api?.zoomIn?.(),
    zoomOut: () => api?.zoomOut?.(),
    setActiveTool: (tool: ComposerTool) => {
      useComposerStore.getState().setActiveTool(tool);
    },
    applyShot: (params) => api?.applyShot?.(params),
    getScene: () => api?.getScene?.() ?? null,
    getCamera: () => api?.getCamera?.() ?? null,
  }), [api]);

  // `api` starts out null and is only set once Workspace's own mount effect runs
  // (a render or two after this component's), so callers waiting to call
  // applyShot/getScene need this rather than assuming the ref is ready on
  // their own first render.
  useEffect(() => {
    if (api) onSceneReady?.();
  }, [api, onSceneReady]);

  return (
    <div className="composer-viewport">
      <Canvas
        className="composer-canvas"
        dpr={DPR}
        camera={CAMERA_CONFIG}
        gl={GL_CONFIG}
      >
        <Workspace grid={grid} axes={axes} ready={setApi} mode={mode} />
        <CompositionController
          enabled={compositionMode}
          command={compositionCommand}
          onCommandConsumed={handleCommandConsumed}
        />
      </Canvas>
      <div className={`workspace-toolbar-wrap${toolbarCollapsed ? ' collapsed' : ''}`}>
        <button
          type="button"
          className="toolbar-toggle"
          onClick={() => setToolbarCollapsed(v => !v)}
          title={toolbarCollapsed ? 'Show toolbar' : 'Hide toolbar'}
          aria-label={toolbarCollapsed ? 'Show toolbar' : 'Hide toolbar'}
        >
          {toolbarCollapsed ? '▲' : '▼'}
        </button>
        <div className="workspace-toolbar">
          {mode === 'motion' && (
            <button
              className={activeTool === 'select' ? 'on' : ''}
              onClick={() => setActiveTool('select')}
              title="Select (drag keyframe path points in the viewport)"
            >
              Select
            </button>
          )}
          <WorkspaceToolbar />
          {mode === 'motion' && (
            <>
              <i />
              <button
                className="primary"
                onClick={() => selectedObjectId && commitLiveKeyframe(selectedObjectId)}
                disabled={!selectedObjectId}
                title="Capture the object's current pose as a new keyframe"
              >
                + Keyframe
              </button>
            </>
          )}
        </div>
      </div>
      {mode === 'static' ? (
        <button className="capture-shot-btn" onClick={() => api?.captureShot()} title="Capture Shot (PNG)">
          Capture Shot
        </button>
      ) : (
        <button className="capture-shot-btn" onClick={handleExportVideo} disabled={exporting} title="Export the full timeline as a video">
          {exporting ? `Exporting… ${Math.round(exportProgress * 100)}%` : 'Download'}
        </button>
      )}
      <CompositionControls enabled={compositionMode} onMove={handleCompositionMove} />
    </div>
  );
});

function Workspace({ grid, axes, ready, mode }: { grid: boolean; axes: boolean; ready: (api: WorkspaceApi) => void; mode: ComposerMode }) {
  const { camera, gl, scene, raycaster } = useThree();
  const [controls, setControls] = useState<OrbitControlsType | null>(null);
  const exportingRef = useRef(false);

  const objects = useComposerStore(s => s.objects);
  const selectedId = useComposerStore(s => s.selectedObjectId);
  const selectObject = useComposerStore(s => s.selectObject);
  const clearSelection = useComposerStore(s => s.clearSelection);
  const activeTool = useComposerStore(s => s.activeTool);
  const objectInstances = useComposerStore(s => s.objectInstances);
  const selectedJointKey = useComposerStore(s => s.selectedJointKey);
  const partScaleMode = useComposerStore(s => s.partScaleMode);
  const selectJoint = useComposerStore(s => s.selectJoint);
  const updateObjectTransform = useComposerStore(s => s.updateObjectTransform);
  const updateObjectPosture = useComposerStore(s => s.updateObjectPosture);
  const updateObjectDefaultPosture = useComposerStore(s => s.updateObjectDefaultPosture);
  const registerObjectInstance = useComposerStore(s => s.registerObjectInstance);
  const unregisterObjectInstance = useComposerStore(s => s.unregisterObjectInstance);
  const beginHistoryGroup = useComposerStore(s => s.beginHistoryGroup);
  const endHistoryGroup = useComposerStore(s => s.endHistoryGroup);
  const selectedKeyframeId = useComposerStore(s => s.selectedKeyframeId);
  const selectKeyframe = useComposerStore(s => s.selectKeyframe);
  const updateKeyframeTransform = useComposerStore(s => s.updateKeyframeTransform);

  const selected = objects.find(o => o.id === selectedId) ?? null;
  const selectedFigure = selectedId ? objectInstances.get(selectedId) ?? null : null;
  const selectedKeyframe = selected?.keyframes.find(k => k.id === selectedKeyframeId) ?? null;

  // Track Object3D roots keyed by object id so we can frame/gizmo the selection.
  const rootsRef = useRef<Map<string, THREE.Object3D>>(new Map());
  const selectedRootRef = useRef<THREE.Object3D | null>(null);
  const framedIds = useRef(new Set<string>());

  /**
   * Puts a newly added object on screen at a usable size, seen head-on. See
   * the direction comment this carried over from Static's own Workspace —
   * mannequin-js bakes body.turn = -90 into every default posture so the
   * figure faces +Z, matching the Front preset's own direction.
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

  const frameOnReady = useRef<() => void>(() => {});
  frameOnReady.current = () => { if (selectedId) frameNewObject(selectedId); };

  const [target, setTarget] = useState<THREE.Object3D | null>(null);
  useEffect(() => {
    setTarget(selectedId ? rootsRef.current.get(selectedId) ?? null : null);
  }, [selectedId, objects]);

  // A separate, persistent Object3D the gizmo attaches to when a keyframe
  // (rather than the live object) is being edited — dragging it must only
  // rewrite that one keyframe's stored transform, never the live root, which
  // AnimatedObject drives independently every frame from the sampled track.
  const keyframeProxyRef = useRef<THREE.Object3D>(new THREE.Object3D());
  useLayoutEffect(() => {
    if (!selectedKeyframe) return;
    const proxy = keyframeProxyRef.current;
    proxy.position.set(...selectedKeyframe.transform.position);
    proxy.rotation.set(...selectedKeyframe.transform.rotation);
    proxy.scale.set(...selectedKeyframe.transform.scale);
  }, [selectedKeyframe]);
  const gizmoTarget = selectedKeyframe ? keyframeProxyRef.current : target;

  // Objects restored with the scene are not new, so they must never pull the
  // camera the first time they are clicked.
  useEffect(() => {
    for (const obj of useComposerStore.getState().objects) framedIds.current.add(obj.id);
  }, []);

  useEffect(() => {
    if (selectedId) frameNewObject(selectedId);
  }, [selectedId, objects, controls]);

  useEffect(() => {
    selectedRootRef.current = selectedId ? rootsRef.current.get(selectedId) ?? null : null;
  }, [selectedId, objects]);

  useEffect(() => {
    if (controls) (camera as any).__orbitControls = controls;
  }, [camera, controls]);

  // Grid/axes/gizmo/keyframe-path chrome live on layer 1 so a second camera
  // that never opts in (a cinematic camera, an export render) never sees it.
  // R3F's shared pointer raycaster only tests layer 0 by default though, so
  // without this, layer-1 chrome renders fine but stops being clickable.
  useEffect(() => {
    camera.layers.enable(1);
    raycaster.layers.enable(1);
  }, [camera, raycaster]);

  useLayoutEffect(() => {
    const c = camera as THREE.PerspectiveCamera;
    if (!controls) return;

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
        const renderer = gl;
        const wasLayer1Enabled = c.layers.isEnabled(1);
        const previousSelectedId = useComposerStore.getState().selectedObjectId;

        // Grid/axes/TransformGizmo/JointGizmo all live on layer 1, so
        // disabling it here hides every one of them from this render with no
        // per-mesh bookkeeping. A selected primitive tints its own material
        // directly though (see PrimitiveObject.tsx) — layer 1 can't hide
        // that, so the selection itself has to clear. flushSync forces that
        // state change through PrimitiveObject's layout effect (which resets
        // the tint) before the render call below, instead of landing a frame later.
        c.layers.disable(1);
        flushSync(() => useComposerStore.getState().clearSelection());

        renderer.render(scene, c);
        renderer.domElement.toBlob((blob: Blob | null) => {
          if (wasLayer1Enabled) c.layers.enable(1);
          if (previousSelectedId) flushSync(() => useComposerStore.getState().selectObject(previousSelectedId));

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
      },
      exportVideo: (onProgress) => {
        if (exportingRef.current) return Promise.resolve();
        exportingRef.current = true;

        // If a cinematic camera object exists, export renders through it via
        // its own offscreen renderer — the interactive canvas/camera are
        // never swapped, so nothing here touches `gl` or the on-screen view.
        const cameraObj = useComposerStore.getState().objects.find(o => o.type === "camera");
        const cineCam = cameraObj ? (rootsRef.current.get(cameraObj.id) as THREE.PerspectiveCamera | undefined) : undefined;

        return exportMotionVideo(scene, (cineCam ?? c) as THREE.PerspectiveCamera, controls, onProgress).finally(() => {
          exportingRef.current = false;
        });
      },
      setActiveTool: (tool) => {
        useComposerStore.getState().setActiveTool(tool);
      },
      // The main viewport camera IS the shot camera: presets move it directly
      // (fov stays whatever the viewport's own fov already is, so this never
      // fights zoom), and nothing here keeps a second, preview-only copy of
      // the solved position/target around.
      applyShot: (params: ShotParams) => {
        const root = selectedRootRef.current;
        if (!root) return;
        const anchors = getCharacterAnchors(root);

        // "ots" looks past the selected/primary character at whichever other
        // character is in the scene — find its root the same way the rest of
        // this file already tracks every object's root (`rootsRef`).
        let targetAnchors: CharacterAnchors | undefined;
        if (params.angle === "ots") {
          const state = useComposerStore.getState();
          const isCharacterType = (t: SceneObject["type"]) => t === "male" || t === "female" || t === "child";
          const other = state.objects.find((o) => o.id !== state.selectedObjectId && isCharacterType(o.type));
          const otherRoot = other ? rootsRef.current.get(other.id) : undefined;
          if (otherRoot) targetAnchors = getCharacterAnchors(otherRoot);
        }

        const solved = solveShot({ ...params, anchors, targetAnchors, fovDeg: c.fov, aspect: c.aspect });
        c.position.copy(solved.position);
        controls.target.copy(solved.target);
        c.lookAt(solved.target);
        c.updateProjectionMatrix();
        controls.update();
      },
      getScene: () => scene,
      getCamera: () => camera,
    });
  }, [camera, controls, gl, scene]);

  return (
    <>
      <color attach="background" args={['#15191d']} />
      <ambientLight intensity={1.4} />
      <directionalLight position={[5, 8, 6]} intensity={2.1} />
      <directionalLight position={[-4, 3, -5]} intensity={0.5} />

      {grid && <gridHelper args={[100, 100, '#3c464b', '#242c30']} ref={(el) => el?.layers.set(1)} />}
      {axes && <axesHelper args={[1.4]} ref={(el) => el?.layers.set(1)} />}

      {/* Click empty space to deselect. Unmounted in pose mode or select
          mode: the plane spans the whole ground and would swallow joint
          picks / keyframe-marker picks — PoseControls/KeyframePath do their
          own clearing there. Mirrors the prototype's `else if (!moveMode)`. */}
      {activeTool !== "pose" && activeTool !== "select" && (
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

      {objects.map((obj) => (
        <AnimatedObject
          key={obj.id}
          object={obj}
          selected={obj.id === selectedId}
          registerInstance={registerObjectInstance}
          unregisterInstance={unregisterObjectInstance}
          onDefaultPosture={updateObjectDefaultPosture}
          onSelect={() => selectObject(obj.id)}
          onReady={(root) => {
            rootsRef.current.set(obj.id, root);
            frameOnReady.current();
          }}
        />
      ))}

      {mode === 'motion' && (
        <KeyframePath
          object={selected}
          activeTool={activeTool}
          selectedKeyframeId={selectedKeyframeId}
          onSelectKeyframe={selectKeyframe}
          onMoveKeyframe={(keyframeId, position) => selectedId && updateKeyframeTransform(selectedId, keyframeId, { position })}
          onDragStart={beginHistoryGroup}
          onDragEnd={endHistoryGroup}
        />
      )}

      <PoseControls
        isPoseMode={activeTool === "pose"}
        figure={selectedFigure}
        onJointSelect={selectJoint}
      />
      <JointGizmo
        isPoseMode={activeTool === "pose"}
        figure={selectedFigure}
        jointKey={selectedJointKey}
        scaleMode={partScaleMode}
        onPostureChange={(posture) => selectedId && updateObjectPosture(selectedId, posture)}
        onDragStart={beginHistoryGroup}
        onDragEnd={endHistoryGroup}
      />
      {mode === 'motion' && <primitive object={keyframeProxyRef.current} />}
      <TransformGizmo
        target={gizmoTarget}
        activeTool={activeTool}
        locked={selected?.locked ?? true}
        transform={selectedKeyframe?.transform ?? selected?.transform ?? null}
        onChange={(t) => {
          if (!selectedId) return;
          if (mode === 'motion' && selectedKeyframeId) { updateKeyframeTransform(selectedId, selectedKeyframeId, t); return; }
          updateObjectTransform(selectedId, t);
        }}
        onDragStart={beginHistoryGroup}
        onDragEnd={endHistoryGroup}
      />
      {mode === 'motion' && <PlaybackDriver />}

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

interface AnimatedObjectProps {
  object: SceneObject;
  selected: boolean;
  registerInstance: (id: string, obj: THREE.Object3D) => void;
  unregisterInstance: (id: string) => void;
  onDefaultPosture: (id: string, posture: Posture) => void;
  onSelect: () => void;
  onReady: (root: THREE.Object3D) => void;
}

/**
 * Owns one object's live transform: samples its keyframes every frame and
 * writes position/rotation/scale (and posture, if any) directly onto the
 * THREE root, bypassing React state entirely so animating N objects never
 * triggers N re-renders per frame. Mannequin/Primitive/Camera get fixed
 * identity transform props for this reason — this component is the only
 * thing that ever moves the root after mount.
 *
 * An object with 0-1 keyframes (Static mode never adds any) or whose
 * liveEditTime still matches elapsed (a live gizmo drag/pose edit, staged
 * separately from `keyframes`) samples straight off `object.transform`/
 * `.posture`/`.fov` instead of the track — the same rendering path covers
 * both Static and Motion mode with no mode branch here.
 */
function AnimatedObject({ object, selected, registerInstance, unregisterInstance, onDefaultPosture, onSelect, onReady }: AnimatedObjectProps) {
  const rootRef = useRef<THREE.Object3D | null>(null);

  useFrame(() => {
    const root = rootRef.current;
    if (!root) return;
    const elapsed = useComposerStore.getState().playback.elapsed;
    const isLive = object.liveEditTime !== null && Math.abs(object.liveEditTime - elapsed) < 1e-6;
    const effectiveLive = isLive || object.keyframes.length === 0;
    const sample = effectiveLive
      ? { transform: object.transform, posture: object.posture, fov: object.fov }
      : sampleTrack(object.keyframes, elapsed);

    root.position.set(...sample.transform.position);
    root.rotation.set(...sample.transform.rotation);
    root.scale.set(...sample.transform.scale);

    if (sample.posture) {
      const figure = useComposerStore.getState().objectInstances.get(object.id);
      if (figure) writePosture(figure as any, sample.posture);
    }
    if (object.type === "camera" && sample.fov !== undefined) {
      const cam = root as THREE.PerspectiveCamera;
      if (cam.fov !== sample.fov) {
        cam.fov = sample.fov;
        cam.updateProjectionMatrix();
      }
    }
  });

  // Stable identity across every re-render — MannequinObject/PrimitiveObject/
  // CameraObject rebuild their figure from scratch whenever `onReady`'s
  // reference changes (it's in their mount effect's deps), which otherwise
  // happens on every store update (any position/pose/keyframe edit replaces
  // `objects`, re-rendering this component).
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;
  const handleReady = useCallback((root: THREE.Object3D) => {
    rootRef.current = root;
    // Seeds the real spawn transform immediately, rather than leaving the
    // root at THREE's default (0,0,0) until the next animation frame —
    // frameNewObject's bounds check runs synchronously in this same commit,
    // before useFrame ever ticks.
    root.position.set(...object.transform.position);
    root.rotation.set(...object.transform.rotation);
    root.scale.set(...object.transform.scale);
    onReadyRef.current(root);
  }, []);

  if (PRIMITIVE_TYPES.includes(object.type)) {
    return (
      <PrimitiveObject
        id={object.id}
        type={object.type as "cube" | "plane" | "cylinder" | "sphere" | "capsule" | "cone" | "torus"}
        name={object.name}
        position={IDENTITY}
        rotation={IDENTITY}
        scale={IDENTITY_SCALE}
        visible={object.visible}
        selected={selected}
        registerInstance={registerInstance}
        unregisterInstance={unregisterInstance}
        onReady={handleReady}
        onSelect={onSelect}
      />
    );
  }

  if (object.type === "camera") {
    return (
      <CameraObject
        id={object.id}
        position={IDENTITY}
        rotation={IDENTITY}
        fov={object.fov}
        visible={object.visible}
        selected={selected}
        registerInstance={registerInstance}
        unregisterInstance={unregisterInstance}
        onReady={handleReady}
        onSelect={onSelect}
      />
    );
  }

  return (
    <MannequinObject
      id={object.id}
      type={object.type as "male" | "female" | "child"}
      name={object.name}
      position={IDENTITY}
      rotation={IDENTITY}
      scale={IDENTITY_SCALE}
      posture={undefined}
      visible={object.visible}
      selected={selected}
      registerInstance={registerInstance}
      unregisterInstance={unregisterInstance}
      onDefaultPosture={onDefaultPosture}
      onReady={handleReady}
      onSelect={onSelect}
    />
  );
}

/** Bare useFrame, no visuals: advances playback.elapsed while playing. */
function PlaybackDriver() {
  useFrame((_, delta) => {
    const { playback, setElapsed, setPlaying } = useComposerStore.getState();
    if (!playback.playing) return;
    const t = Math.min(playback.duration, playback.elapsed + delta * playback.speed);
    setElapsed(t);
    if (t >= playback.duration) setPlaying(false);
  });
  return null;
}

interface KeyframePathProps {
  object: SceneObject | null;
  activeTool: ComposerTool;
  selectedKeyframeId: string | null;
  onSelectKeyframe: (id: string) => void;
  onMoveKeyframe: (keyframeId: string, position: [number, number, number]) => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}

const MARKER_COLOR = "#4ade80";
const MARKER_SELECTED_COLOR = "#f87171";

/**
 * The selected object's motion path: a polyline through its keyframes
 * (editor chrome, layer 1) plus one small draggable sphere per keyframe —
 * the viewport-space counterpart to Timeline.tsx's time-space markers.
 *
 * Built imperatively (THREE.Line + a THREE.Group of meshes managed by hand),
 * matching JointGizmo/PoseControls' own manual-raycast pattern rather than
 * R3F's JSX pointer events — R3F's built-in picking raycaster only tests
 * layer 0 by default, so layer-1 meshes would otherwise never receive a
 * pointer event.
 *
 * Dragging projects the pointer onto a ground-parallel plane at the
 * keyframe's own height, so a drag moves the point across the floor, not
 * toward/away from camera.
 * ponytail: height (Y) is not draggable this way; add a vertical handle if
 * users need to raise/lower a path point off the ground.
 */
function KeyframePath({ object, activeTool, selectedKeyframeId, onSelectKeyframe, onMoveKeyframe, onDragStart, onDragEnd }: KeyframePathProps) {
  const { camera, gl, scene } = useThree();
  const line = useRef<THREE.Line>(
    new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: "#8b93a1" })),
  ).current;
  const group = useRef<THREE.Group>(new THREE.Group()).current;
  const sphereGeometry = useRef(new THREE.SphereGeometry(0.06, 12, 12)).current;
  const markers = useRef<Map<string, THREE.Mesh>>(new Map()).current;

  useLayoutEffect(() => {
    line.layers.set(1);
    group.layers.set(1);
    scene.add(line, group);
    return () => {
      scene.remove(line, group);
    };
  }, [line, group, scene]);

  useLayoutEffect(() => {
    const sorted = object ? [...object.keyframes].sort((a, b) => a.time - b.time) : [];

    if (sorted.length < 2) {
      line.visible = false;
    } else {
      line.visible = true;
      line.geometry.setFromPoints(sorted.map((k) => new THREE.Vector3(...k.transform.position)));
    }

    const liveIds = new Set(sorted.map((k) => k.id));
    for (const [id, mesh] of markers) {
      if (liveIds.has(id)) continue;
      group.remove(mesh);
      (mesh.material as THREE.Material).dispose();
      markers.delete(id);
    }
    for (const kf of sorted) {
      let mesh = markers.get(kf.id);
      if (!mesh) {
        mesh = new THREE.Mesh(sphereGeometry, new THREE.MeshBasicMaterial());
        mesh.layers.set(1);
        mesh.userData.keyframeId = kf.id;
        group.add(mesh);
        markers.set(kf.id, mesh);
      }
      mesh.position.set(...kf.transform.position);
      (mesh.material as THREE.MeshBasicMaterial).color.set(kf.id === selectedKeyframeId ? MARKER_SELECTED_COLOR : MARKER_COLOR);
    }
  }, [object, object?.keyframes, selectedKeyframeId, line, group, sphereGeometry, markers]);

  const onSelectKeyframeRef = useRef(onSelectKeyframe);
  onSelectKeyframeRef.current = onSelectKeyframe;
  const onMoveKeyframeRef = useRef(onMoveKeyframe);
  onMoveKeyframeRef.current = onMoveKeyframe;
  const onDragStartRef = useRef(onDragStart);
  onDragStartRef.current = onDragStart;
  const onDragEndRef = useRef(onDragEnd);
  onDragEndRef.current = onDragEnd;

  useEffect(() => {
    if (!object || activeTool !== "select") return;

    const domElement = gl.domElement;
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const plane = new THREE.Plane();
    const dragPoint = new THREE.Vector3();
    let draggingId: string | null = null;

    function setPointer(event: PointerEvent) {
      const rect = domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    }

    function onPointerDown(event: PointerEvent) {
      if (event.button !== 0 || event.shiftKey || event.ctrlKey || event.metaKey) return;
      setPointer(event);
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects(Array.from(markers.values()), false)[0];
      if (!hit) return;

      const keyframeId = hit.object.userData.keyframeId as string;
      onSelectKeyframeRef.current(keyframeId);
      draggingId = keyframeId;
      onDragStartRef.current();
      const orbit = (camera as any).__orbitControls;
      if (orbit) orbit.enabled = false;
      plane.setFromNormalAndCoplanarPoint(new THREE.Vector3(0, 1, 0), hit.object.position);
      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerUp);
    }

    function onPointerMove(event: PointerEvent) {
      if (!draggingId) return;
      setPointer(event);
      raycaster.setFromCamera(pointer, camera);
      if (!raycaster.ray.intersectPlane(plane, dragPoint)) return;
      const mesh = markers.get(draggingId);
      onMoveKeyframeRef.current(draggingId, [dragPoint.x, mesh?.position.y ?? 0, dragPoint.z]);
    }

    function onPointerUp() {
      if (draggingId) onDragEndRef.current();
      draggingId = null;
      const orbit = (camera as any).__orbitControls;
      if (orbit) orbit.enabled = true;
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    }

    domElement.addEventListener("pointerdown", onPointerDown);
    return () => {
      domElement.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      // Switching tool/selection mid-drag skips pointerup, which would
      // otherwise leave orbit disabled and the history group open.
      if (draggingId) {
        onDragEndRef.current();
        const orbit = (camera as any).__orbitControls;
        if (orbit) orbit.enabled = true;
      }
    };
  }, [object?.id, activeTool, camera, gl, markers]);

  return null;
}
