import { useEffect } from "react";
import * as THREE from "three";
import { useThree } from "@react-three/fiber";
import { TransformControls } from "three/examples/jsm/controls/TransformControls.js";
import { useComposerStore } from "../../stores/composerStore";
import { addRingArrowheads } from "./helpers/gizmoArrowheads";
import { readPosture } from "./helpers/posture";

/**
 * The rotation/scale gizmo for a single mannequin joint.
 *
 * Uses three's own TransformControls rather than drei's, because the direction
 * arrowheads reach into the private `_gizmo` field and drei wraps three-stdlib's
 * fork, which does not carry it. This one is driven imperatively, so it also
 * never re-mounts mid-drag.
 *
 * The gizmo attaches to the JOINT, never to `joint.imageWrapper`. Child joints
 * hang off the parent's wrapper, so rotating the wrapper looks identical on
 * screen — but `.posture` reads the joint's own rotation, so saving would store
 * the unedited pose. In scale mode it attaches to `joint.image`, the part's own
 * shape, which is the only thing under a joint that belongs to that part alone.
 */
/**
 * mannequin-js's `Joint.select()` tints by writing a *negative* emissive,
 * `setRGB(0, -1, -0.4)`, to subtract green and blue and leave the part red. That
 * only works under its own stage's `NoToneMapping`, where the negatives clamp to
 * zero. R3F's Canvas defaults to ACESFilmicToneMapping, whose `RRTAndODTFit` is
 * v²-dominated — so a channel of -1 comes back *positive* (~1.24) and the ACES
 * matrices then smear it across the other two. That is the yellow-green: a
 * mid-lit antiquewhite limb renders #96dd3c instead of red, and a brightly lit
 * one washes out to near-white, so the tint is not even consistent body to body.
 *
 * Overriding the base colour instead is tone-mapping-safe: darkred stays
 * red-dominant through ACES across the full lighting range here (#590000 in
 * shadow to #f60112 at the brightest), with green and blue at ~0.
 *
 * Same subtree traversal as `select()`, so which parts light up is unchanged.
 */
const SELECT_COLOR = new THREE.Color("darkred");

function highlightJoint(joint: THREE.Object3D) {
  const saved = new Map<any, THREE.Color>();
  joint.traverse((o) => {
    const mat = (o as any).material;
    if (!mat) return;
    for (const m of Array.isArray(mat) ? mat : [mat]) {
      // Skip already-saved: a material reached twice would otherwise have the
      // highlight colour recorded as its original and stay red after deselect.
      if (!m?.color || saved.has(m)) continue;
      saved.set(m, m.color);
      m.color = SELECT_COLOR.clone();
    }
  });
  return () => saved.forEach((color, m) => { m.color = color; });
}

export default function JointGizmo() {
  const { camera, gl, scene } = useThree();
  const activeTool = useComposerStore((s) => s.activeTool);
  const selectedId = useComposerStore((s) => s.selectedObjectId);
  const selectedJointKey = useComposerStore((s) => s.selectedJointKey);
  const partScaleMode = useComposerStore((s) => s.partScaleMode);
  const objectInstances = useComposerStore((s) => s.objectInstances);
  const updatePosture = useComposerStore((s) => s.updateObjectPosture);

  const isPoseMode = activeTool === "pose";

  useEffect(() => {
    if (!isPoseMode || !selectedId || !selectedJointKey) return;

    const figure = objectInstances.get(selectedId) as any;
    const joint = figure?.[selectedJointKey];
    if (!joint) return;

    const controls = new TransformControls(camera, gl.domElement);
    controls.setSpace("local");
    controls.setSize(0.45); // 0.8 is large enough to cage the figure
    controls.setMode(partScaleMode ? "scale" : "rotate");
    controls.attach(partScaleMode ? joint.image : joint);

    const helper = controls.getHelper();
    scene.add(helper);
    // PoseControls reads this to tell a handle drag from a joint pick, the same
    // way TransformGizmo already finds OrbitControls.
    (camera as any).__jointGizmo = controls;
    if (!partScaleMode) addRingArrowheads(controls);

    const clearHighlight = highlightJoint(joint);

    const orbit = (camera as any).__orbitControls;
    const { beginHistoryGroup, endHistoryGroup } = useComposerStore.getState();

    // The whole ring drag is one undo step, not one per frame.
    let dragging = false;
    const onDragStart = () => {
      dragging = true;
      beginHistoryGroup();
      if (orbit) orbit.enabled = false;
    };
    const onDragEnd = () => {
      dragging = false;
      endHistoryGroup();
      if (orbit) orbit.enabled = true;
    };

    const onObjectChange = () => {
      figure.updateMatrixWorld(true);
      // Scale lives on the mesh, not in posture data, so only rotation is stored.
      // readPosture, not `.posture`, or a drag on an elbow/knee ring would be
      // thrown away by the round trip through the store and snap back.
      if (!partScaleMode) updatePosture(selectedId, readPosture(figure));
    };

    controls.addEventListener("mouseDown", onDragStart);
    controls.addEventListener("mouseUp", onDragEnd);
    controls.addEventListener("objectChange", onObjectChange);

    return () => {
      controls.removeEventListener("mouseDown", onDragStart);
      controls.removeEventListener("mouseUp", onDragEnd);
      controls.removeEventListener("objectChange", onObjectChange);
      // Deselecting mid-drag skips mouseUp, which would otherwise leave the
      // history group open and swallow every later edit.
      if (dragging) endHistoryGroup();
      clearHighlight();
      (camera as any).__jointGizmo = null;
      controls.detach();
      scene.remove(helper);
      controls.dispose();
      if (orbit) orbit.enabled = true;
    };
  }, [
    isPoseMode, selectedId, selectedJointKey, partScaleMode,
    camera, gl, scene, objectInstances, updatePosture,
  ]);

  return null;
}
