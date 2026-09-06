/**
 * Small, static 3D render of one shot — used wherever the Library needs a
 * "real" visual instead of a technical diagram (hero art, category cards,
 * per-value browse cards). Deliberately NOT the calibration tool: no helper
 * wireframe, no scissor split, no preview-frame chrome — just the mannequin
 * framed by the solved camera, rendered once and left alone.
 *
 * Grid usage (`cacheKey` set) never keeps more than one live WebGL context
 * open: each thumbnail mounts a Canvas only once it scrolls into view, waits
 * its turn in a single-file queue, renders exactly one frame, captures it to
 * a PNG data URL, then unmounts the Canvas in favor of a plain <img>. A
 * browser only grants a couple dozen concurrent WebGL contexts — rendering
 * all cards live at once (the previous behavior) silently blanked out
 * every card past that limit. Without `cacheKey` (the hero image, one
 * instance) the Canvas just stays live, matching the old behavior exactly.
 */
import { Canvas, useThree } from "@react-three/fiber";
import { useEffect, useId, useRef, useState } from "react";
import * as THREE from "three";
import MannequinObject, { type MannequinHandle } from "../../composer/MannequinObject";
import { groundFigure } from "../../composer/helpers/mannequinFactory";
import { writePosture, type Posture } from "../../composer/helpers/posture";
import { getCharacterAnchors, solveShot, type ShotParams } from "./shotSolver";
import { DEFAULT_COMPOSITION_PRESET } from "./compositionPresets";
import { SHOT_CAMERA_DEFAULT_FOV, SHOT_CAMERA_FAR, SHOT_CAMERA_NEAR, STANDING_POSITION, STANDING_ROTATION } from "./scene";

/** Fixed framing for a pose preview — poses have no shot axes of their own, so this just needs to show the whole figure clearly. */
const POSE_SHOT_PARAMS: ShotParams = {
  shotSize: "full",
  angle: "front",
  elevation: "eye",
  composition: DEFAULT_COMPOSITION_PRESET,
};

const captureCache = new Map<string, string>();
const captureQueue: (() => void)[] = [];
let captureBusy = false;

function runNextCapture() {
  if (captureBusy) return;
  const next = captureQueue.shift();
  if (!next) return;
  captureBusy = true;
  next();
}

function finishCapture() {
  captureBusy = false;
  runNextCapture();
}

function useInView(rootMargin = "200px"): [React.RefObject<HTMLDivElement | null>, boolean] {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    if (inView) return;
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) setInView(true);
    }, { rootMargin });
    observer.observe(el);
    return () => observer.disconnect();
  }, [rootMargin, inView]);
  return [ref, inView];
}

function ThumbnailScene({ params, aspect, onCaptured }: { params: ShotParams; aspect: number; onCaptured?: (url: string) => void }) {
  const id = useId();
  const mannequinRef = useRef<MannequinHandle>(null);
  const { camera, gl, scene, invalidate } = useThree();

  useEffect(() => {
    const cam = camera as THREE.PerspectiveCamera;
    cam.aspect = aspect;
    cam.updateProjectionMatrix();
    invalidate();
  }, [camera, aspect, invalidate]);

  function frame() {
    const root = mannequinRef.current?.root;
    if (!root) return;
    const anchors = getCharacterAnchors(root);
    const solved = solveShot({ ...params, anchors, fovDeg: SHOT_CAMERA_DEFAULT_FOV, aspect });
    camera.position.copy(solved.position);
    camera.lookAt(solved.target);
    if (onCaptured) {
      gl.render(scene, camera);
      onCaptured(gl.domElement.toDataURL("image/png"));
    } else {
      invalidate();
    }
  }

  return (
    <>
      <color attach="background" args={["#101315"]} />
      <ambientLight intensity={1.4} />
      <directionalLight position={[5, 8, 6]} intensity={2.1} />
      <directionalLight position={[-4, 3, -5]} intensity={0.5} />
      <MannequinObject
        ref={mannequinRef}
        id={id}
        type="male"
        position={STANDING_POSITION}
        rotation={STANDING_ROTATION}
        registerInstance={() => {}}
        unregisterInstance={() => {}}
        onDefaultPosture={() => {}}
        onReady={frame}
      />
    </>
  );
}

/** Shared by every thumbnail flavor (shot, pose, …): scroll-into-view gating, the single-file capture queue, and the resulting cache/`<img>` swap. Only the Canvas contents differ per flavor. */
function useQueuedCapture(cacheKey: string | undefined) {
  const [ref, inView] = useInView();
  const [image, setImage] = useState<string | null>(() => (cacheKey ? captureCache.get(cacheKey) ?? null : null));
  const [active, setActive] = useState(!cacheKey);

  useEffect(() => {
    if (!cacheKey || image || active || !inView) return;
    let cancelled = false;
    captureQueue.push(() => {
      if (cancelled) {
        finishCapture();
        return;
      }
      setActive(true);
    });
    runNextCapture();
    return () => {
      cancelled = true;
    };
  }, [cacheKey, image, active, inView]);

  // If this card scrolls out of the list (filtered/paginated away) while it
  // holds the queue's one active slot, release the slot so the queue doesn't
  // stall forever waiting on a capture that will never happen.
  useEffect(() => {
    if (!active || !cacheKey) return;
    return () => {
      if (!captureCache.has(cacheKey)) finishCapture();
    };
  }, [active, cacheKey]);

  function handleCaptured(url: string) {
    if (cacheKey) captureCache.set(cacheKey, url);
    setImage(url);
    setActive(false);
    finishCapture();
  }

  return { ref, image, active, handleCaptured };
}

/** `cacheKey` opts into the queued capture-once-to-<img> behavior; omit it (e.g. the single hero image) to keep a plain always-live Canvas. */
export function ShotThumbnail({ params, width, height, cacheKey }: { params: ShotParams; width: number; height: number; cacheKey?: string }) {
  const { ref, image, active, handleCaptured } = useQueuedCapture(cacheKey);

  return (
    <div ref={ref} style={{ width: "100%", aspectRatio: `${width} / ${height}`, borderRadius: 8, overflow: "hidden", background: "#101315" }}>
      {image ? (
        <img src={image} alt="" style={{ display: "block", width: "100%", height: "100%", objectFit: "cover" }} />
      ) : active ? (
        <Canvas
          frameloop="demand"
          dpr={[1, 1.5]}
          camera={{ fov: SHOT_CAMERA_DEFAULT_FOV, near: SHOT_CAMERA_NEAR, far: SHOT_CAMERA_FAR }}
        >
          <ThumbnailScene params={params} aspect={width / height} onCaptured={cacheKey ? handleCaptured : undefined} />
        </Canvas>
      ) : null}
    </div>
  );
}

function PoseThumbnailScene({ posture, aspect, onCaptured }: { posture: Posture; aspect: number; onCaptured?: (url: string) => void }) {
  const id = useId();
  const { camera, gl, scene, invalidate } = useThree();

  useEffect(() => {
    const cam = camera as THREE.PerspectiveCamera;
    cam.aspect = aspect;
    cam.updateProjectionMatrix();
    invalidate();
  }, [camera, aspect, invalidate]);

  // Written directly onto the just-built figure here (not via MannequinObject's
  // `posture` prop) because that prop's own apply-effect fires on the next
  // commit — after this capture would already have fired the default pose.
  function frame(root: THREE.Object3D) {
    const figure = root.children[0] as any;
    if (figure) {
      writePosture(figure, posture);
      groundFigure(figure);
    }
    const anchors = getCharacterAnchors(root);
    const solved = solveShot({ ...POSE_SHOT_PARAMS, anchors, fovDeg: SHOT_CAMERA_DEFAULT_FOV, aspect });
    camera.position.copy(solved.position);
    camera.lookAt(solved.target);
    if (onCaptured) {
      gl.render(scene, camera);
      onCaptured(gl.domElement.toDataURL("image/png"));
    } else {
      invalidate();
    }
  }

  return (
    <>
      <color attach="background" args={["#101315"]} />
      <ambientLight intensity={1.4} />
      <directionalLight position={[5, 8, 6]} intensity={2.1} />
      <directionalLight position={[-4, 3, -5]} intensity={0.5} />
      <MannequinObject
        id={id}
        type="male"
        position={STANDING_POSITION}
        rotation={STANDING_ROTATION}
        registerInstance={() => {}}
        unregisterInstance={() => {}}
        onDefaultPosture={() => {}}
        onReady={frame}
      />
    </>
  );
}

/** Same queued render-once-to-PNG mechanism as ShotThumbnail, framed by a fixed shot instead of a solved `ShotParams`, and posed via a direct posture write instead of the (composition-driven) figure default. */
export function PoseThumbnail({ posture, width, height, cacheKey }: { posture: Posture; width: number; height: number; cacheKey?: string }) {
  const { ref, image, active, handleCaptured } = useQueuedCapture(cacheKey);

  return (
    <div ref={ref} style={{ width: "100%", aspectRatio: `${width} / ${height}`, borderRadius: 8, overflow: "hidden", background: "#101315" }}>
      {image ? (
        <img src={image} alt="" style={{ display: "block", width: "100%", height: "100%", objectFit: "cover" }} />
      ) : active ? (
        <Canvas
          frameloop="demand"
          dpr={[1, 1.5]}
          camera={{ fov: SHOT_CAMERA_DEFAULT_FOV, near: SHOT_CAMERA_NEAR, far: SHOT_CAMERA_FAR }}
        >
          <PoseThumbnailScene posture={posture} aspect={width / height} onCaptured={cacheKey ? handleCaptured : undefined} />
        </Canvas>
      ) : null}
    </div>
  );
}
