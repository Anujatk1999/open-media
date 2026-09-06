/**
 * Shot Solver — turns four semantic parameters (shot size, camera angle,
 * elevation, composition) into a camera position + look-at target for a
 * single standing character, so nobody has to hand-place XYZ coordinates.
 *
 * Anchors (feet/hip/chest/head) are approximated as fixed fractions of the
 * character's bounding-box height rather than read from mannequin-js bones —
 * ponytail: good enough to prove framing math works; swap in real joint
 * world-positions here if a pose ever puts the head/hip somewhere the
 * fraction guess doesn't hold (e.g. crouching).
 */
import * as THREE from "three";

export type ShotSize = "wide" | "full" | "medium" | "mcu" | "closeup";
export type CameraAngle = "front" | "threeQuarterLeft" | "threeQuarterRight" | "profile" | "back" | "ots";
export type Elevation = "eye" | "low" | "high";

/**
 * A composition preset defines only where the framed subject should land on
 * screen — normalized 0..1, X: 0=left/1=right, Y: 0=bottom/1=top. The solver
 * has no notion of "thirds" or "golden ratio" or "OTS" — it only ever reads
 * screenX/screenY off whatever preset it's given, so new preset *kinds*
 * (golden ratio, leading lines, OTS, multi-character) plug in by producing a
 * CompositionPreset elsewhere, without touching solveShot.
 */
export interface CompositionPreset {
  id: string;
  label: string;
  screenX: number;
  screenY: number;
}

export interface ShotParams {
  shotSize: ShotSize;
  angle: CameraAngle;
  elevation: Elevation;
  composition: CompositionPreset;
}

export interface CharacterAnchors {
  feet: number;
  hip: number;
  chest: number;
  head: number;
  centerX: number;
  centerZ: number;
  height: number;
  /**
   * World yaw (radians) the character currently faces, in this module's
   * azimuth convention (0 = the same +Z the "front" angle shoots from, i.e.
   * a camera at azimuth 0 sees this character's face). Every angle except
   * "ots" ignores it and keeps its original fixed world-space azimuth.
   */
  facingYaw: number;
}

/** Reads the character's current world bounding box + facing and derives anchors from it. */
export function getCharacterAnchors(root: THREE.Object3D): CharacterAnchors {
  root.updateWorldMatrix(true, true);
  const box = new THREE.Box3().setFromObject(root);
  const feet = box.min.y;
  const height = Math.max(box.max.y - feet, 0.01);
  const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(root.getWorldQuaternion(new THREE.Quaternion()));
  return {
    feet,
    hip: feet + height * 0.5,
    chest: feet + height * 0.72,
    head: feet + height * 0.93,
    centerX: (box.min.x + box.max.x) / 2,
    centerZ: (box.min.z + box.max.z) / 2,
    height,
    facingYaw: Math.atan2(forward.x, forward.z),
  };
}

/** Vertical frame span, as fractions of character height measured from the feet. */
export const SHOT_SIZE_SPAN: Record<ShotSize, { bottom: number; top: number }> = {
  wide: { bottom: -0.35, top: 1.25 },
  full: { bottom: -0.05, top: 1.1 },
  medium: { bottom: 0.45, top: 1.15 },
  mcu: { bottom: 0.65, top: 1.15 },
  closeup: { bottom: 0.78, top: 1.12 },
};

/** Fraction of the frame's height the framed span should fill, leaving headroom margin. */
const FRAME_FILL = 0.92;

export const ANGLE_AZIMUTH_DEG: Record<CameraAngle, number> = {
  front: 0,
  threeQuarterRight: 45,
  threeQuarterLeft: -45,
  profile: 90,
  back: 180,
  // Read relative to the character's own facing (see solveShot), not world
  // space like every other entry here: 180 would be dead behind the head,
  // so this leans 30° off that toward one shoulder.
  ots: 150,
};

/**
 * How close an "ots" camera sits to the primary's shoulder, as a fraction of
 * their height — deliberately independent of FRAME_FILL/fovDeg, unlike every
 * other angle: OTS is defined by hugging the near character, not by framing
 * them, so shot size only nudges that closeness rather than driving it.
 */
const OTS_PROXIMITY_RATIO: Record<ShotSize, number> = {
  wide: 0.55,
  full: 0.45,
  medium: 0.38,
  mcu: 0.3,
  closeup: 0.22,
};

/** Camera height, as a fraction of character height measured from the feet. */
export const ELEVATION_RATIO: Record<Elevation, number> = {
  eye: 0.93,
  low: 0.15,
  high: 1.35,
};

export interface SolveShotInput extends ShotParams {
  anchors: CharacterAnchors;
  /** The "other" character an "ots" shot looks past the primary toward. Ignored by every other angle. */
  targetAnchors?: CharacterAnchors;
  fovDeg: number;
  aspect: number;
}

export interface SolvedShot {
  position: THREE.Vector3;
  target: THREE.Vector3;
}

export function solveShot(input: SolveShotInput): SolvedShot {
  const { anchors, targetAnchors, shotSize, angle, elevation, composition, fovDeg, aspect } = input;

  const span = SHOT_SIZE_SPAN[shotSize];
  const frameBottom = anchors.feet + span.bottom * anchors.height;
  const frameTop = anchors.feet + span.top * anchors.height;
  const frameCenterY = (frameBottom + frameTop) / 2;
  const frameHeight = frameTop - frameBottom;

  const isOTS = angle === "ots";
  const vFovRad = THREE.MathUtils.degToRad(fovDeg);
  // Every other angle solves the distance needed to frame the primary at the
  // requested shot size. "ots" instead sits close to the primary's shoulder
  // regardless of shot size — using the frame-fill distance here was the bug:
  // it put the camera a normal shot's distance away, so it read as an
  // off-center "back" composition instead of a real over-the-shoulder.
  const distance = isOTS
    ? OTS_PROXIMITY_RATIO[shotSize] * anchors.height
    : frameHeight / 2 / (FRAME_FILL * Math.tan(vFovRad / 2));

  // "ots" measures its azimuth relative to the character's *current* facing
  // (anchors.facingYaw), so the camera stays behind their shoulder as they
  // turn; every other angle keeps the original fixed world-space azimuth.
  const azimuthRad = THREE.MathUtils.degToRad(ANGLE_AZIMUTH_DEG[angle]) + (isOTS ? anchors.facingYaw : 0);
  const cameraY = anchors.feet + ELEVATION_RATIO[elevation] * anchors.height;
  const position = new THREE.Vector3(
    anchors.centerX + Math.sin(azimuthRad) * distance,
    cameraY,
    anchors.centerZ + Math.cos(azimuthRad) * distance
  );

  // Every other angle frames the primary character itself. "ots" instead
  // looks past the primary — who's meant to read as foreground, not the
  // shot's subject — toward whichever other character is in the scene, or
  // straight ahead of the primary along their own current facing if there
  // isn't one.
  const subjectPoint = isOTS
    ? targetAnchors
      ? new THREE.Vector3(targetAnchors.centerX, targetAnchors.chest, targetAnchors.centerZ)
      : new THREE.Vector3(
          anchors.centerX + Math.sin(anchors.facingYaw) * anchors.height,
          frameCenterY,
          anchors.centerZ + Math.cos(anchors.facingYaw) * anchors.height
        )
    : new THREE.Vector3(anchors.centerX, frameCenterY, anchors.centerZ);

  const forward = subjectPoint.clone().sub(position).normalize();
  const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();
  const up = new THREE.Vector3().crossVectors(right, forward).normalize();

  const hFovRad = 2 * Math.atan(Math.tan(vFovRad / 2) * aspect);
  // Looking at a point shifted toward `right`/`up` of the subject pushes the
  // subject toward the opposite screen edge, so both offsets are inverted
  // from the desired screen position.
  const xOffset = 0.5 - composition.screenX;
  const yOffset = 0.5 - composition.screenY;
  const yawOffsetRad = Math.atan(xOffset * 2 * Math.tan(hFovRad / 2));
  const pitchOffsetRad = Math.atan(yOffset * 2 * Math.tan(vFovRad / 2));

  const aimDistance = subjectPoint.distanceTo(position);
  const target = subjectPoint
    .clone()
    .addScaledVector(right, aimDistance * Math.tan(yawOffsetRad))
    .addScaledVector(up, aimDistance * Math.tan(pitchOffsetRad));

  return { position, target };
}

const CENTER_PRESET: CompositionPreset = { id: "center", label: "Center", screenX: 0.5, screenY: 0.5 };
const LEFT_PRESET: CompositionPreset = { id: "left", label: "Left", screenX: 1 / 3, screenY: 0.5 };
const RIGHT_PRESET: CompositionPreset = { id: "right", label: "Right", screenX: 2 / 3, screenY: 0.5 };
const UPPER_PRESET: CompositionPreset = { id: "upper", label: "Upper", screenX: 0.5, screenY: 2 / 3 };
const LOWER_PRESET: CompositionPreset = { id: "lower", label: "Lower", screenX: 0.5, screenY: 1 / 3 };

function frameCenterYFor(shotSize: ShotSize, anchors: CharacterAnchors): number {
  const span = SHOT_SIZE_SPAN[shotSize];
  return anchors.feet + ((span.bottom + span.top) / 2) * anchors.height;
}

/**
 * The one runnable check for this module — no test framework in this repo.
 * Confirms composition actually pushes the subject to the requested screen
 * position (via real NDC projection, not trusting the algebra by eye), that
 * shot size changes distance, and that this still holds across every shot
 * size / angle combination — not just the one case it was derived against.
 */
export function assertShotSolverBasics(): void {
  const anchors: CharacterAnchors = {
    feet: 0,
    hip: 0.85,
    chest: 1.22,
    head: 1.58,
    centerX: 0,
    centerZ: 0,
    height: 1.7,
    facingYaw: 0,
  };
  const base = { anchors, fovDeg: 40, aspect: 16 / 9 };
  const camera = new THREE.PerspectiveCamera(40, 16 / 9, 0.01, 100);

  const projectSubject = (shot: SolvedShot, shotSize: ShotSize) => {
    camera.position.copy(shot.position);
    camera.lookAt(shot.target);
    camera.updateMatrixWorld(true);
    camera.updateProjectionMatrix();
    const subjectY = frameCenterYFor(shotSize, anchors);
    return new THREE.Vector3(anchors.centerX, subjectY, anchors.centerZ).project(camera);
  };

  const center = solveShot({ ...base, shotSize: "medium", angle: "front", elevation: "eye", composition: CENTER_PRESET });
  const left = solveShot({ ...base, shotSize: "medium", angle: "front", elevation: "eye", composition: LEFT_PRESET });
  const right = solveShot({ ...base, shotSize: "medium", angle: "front", elevation: "eye", composition: RIGHT_PRESET });
  const upper = solveShot({ ...base, shotSize: "medium", angle: "front", elevation: "eye", composition: UPPER_PRESET });
  const lower = solveShot({ ...base, shotSize: "medium", angle: "front", elevation: "eye", composition: LOWER_PRESET });

  console.assert(Math.abs(projectSubject(center, "medium").x) < 0.05, "[shotSolver] center composition should sit at screen-center");
  console.assert(projectSubject(left, "medium").x < -0.1, "[shotSolver] left composition should push the subject left");
  console.assert(projectSubject(right, "medium").x > 0.1, "[shotSolver] right composition should push the subject right");
  console.assert(projectSubject(upper, "medium").y > 0.1, "[shotSolver] upper composition should push the subject up");
  console.assert(projectSubject(lower, "medium").y < -0.1, "[shotSolver] lower composition should push the subject down");

  const closeup = solveShot({ ...base, shotSize: "closeup", angle: "front", elevation: "eye", composition: CENTER_PRESET });
  const wide = solveShot({ ...base, shotSize: "wide", angle: "front", elevation: "eye", composition: CENTER_PRESET });
  console.assert(
    closeup.position.distanceTo(closeup.target) < wide.position.distanceTo(wide.target),
    "[shotSolver] a close-up should sit closer to the subject than a wide shot"
  );

  const front = solveShot({ ...base, shotSize: "medium", angle: "front", elevation: "eye", composition: CENTER_PRESET });
  const back = solveShot({ ...base, shotSize: "medium", angle: "back", elevation: "eye", composition: CENTER_PRESET });
  console.assert(
    front.position.z > 0 && back.position.z < 0,
    "[shotSolver] front and back angles should place the camera on opposite sides"
  );

  const low = solveShot({ ...base, shotSize: "medium", angle: "front", elevation: "low", composition: CENTER_PRESET });
  const high = solveShot({ ...base, shotSize: "medium", angle: "front", elevation: "high", composition: CENTER_PRESET });
  console.assert(low.position.y < high.position.y, "[shotSolver] low elevation should sit below high elevation");

  // "ots" is an aim mode, not a subject-framing mode like every other angle —
  // check it aims past the primary at the second character when one exists
  // (instead of collapsing to a plain "back" shot of the primary), sits
  // behind the primary like "back" does, and still looks generally ahead of
  // the primary when there's no second character to shoot over the shoulder of.
  const secondaryAnchors: CharacterAnchors = { ...anchors, centerZ: anchors.centerZ + 2 };
  const otsWithSecondary = solveShot({ ...base, shotSize: "medium", angle: "ots", elevation: "eye", composition: CENTER_PRESET, targetAnchors: secondaryAnchors });
  console.assert(
    otsWithSecondary.target.distanceTo(new THREE.Vector3(secondaryAnchors.centerX, secondaryAnchors.chest, secondaryAnchors.centerZ)) <
      otsWithSecondary.target.distanceTo(new THREE.Vector3(anchors.centerX, anchors.chest, anchors.centerZ)),
    "[shotSolver] ots with a second character should aim past the primary toward them"
  );
  console.assert(otsWithSecondary.position.z < 0, "[shotSolver] ots camera should sit behind the primary character");
  const otsSolo = solveShot({ ...base, shotSize: "medium", angle: "ots", elevation: "eye", composition: CENTER_PRESET });
  console.assert(otsSolo.target.z > anchors.centerZ, "[shotSolver] ots with no second character should still look ahead of the primary");
  console.assert(
    otsSolo.position.distanceTo(new THREE.Vector3(anchors.centerX, otsSolo.position.y, anchors.centerZ)) < anchors.height,
    "[shotSolver] ots camera should sit close to the primary's shoulder, not a full shot's distance away"
  );

  // The camera must stay behind whichever way the character is actually
  // facing, not a world-fixed direction — otherwise turning the character
  // stops looking like an over-the-shoulder shot at all.
  const turnedAnchors: CharacterAnchors = { ...anchors, facingYaw: Math.PI / 2 };
  const otsTurned = solveShot({ ...base, anchors: turnedAnchors, shotSize: "medium", angle: "ots", elevation: "eye", composition: CENTER_PRESET });
  console.assert(
    Math.abs(otsTurned.position.x - otsSolo.position.z) < 0.01 && Math.abs(otsTurned.position.z - (-otsSolo.position.x)) < 0.01,
    "[shotSolver] ots camera placement should rotate along with the character's facing"
  );

  // Composition must land within tolerance across every shot size / angle
  // combination the solver claims to support — not just the "medium, front"
  // case the point checks above happen to use.
  const sweepPresets = [CENTER_PRESET, LEFT_PRESET, RIGHT_PRESET, UPPER_PRESET, LOWER_PRESET];
  const sweepShotSizes: ShotSize[] = ["wide", "full", "medium", "mcu", "closeup"];
  const sweepAngles: CameraAngle[] = ["front", "threeQuarterLeft", "threeQuarterRight", "profile"];
  const TOLERANCE = 0.08;
  let sweepFailures = 0;
  for (const shotSize of sweepShotSizes) {
    for (const angle of sweepAngles) {
      for (const preset of sweepPresets) {
        const shot = solveShot({ ...base, shotSize, angle, elevation: "eye", composition: preset });
        const ndc = projectSubject(shot, shotSize);
        const expectedX = preset.screenX * 2 - 1;
        const expectedY = preset.screenY * 2 - 1;
        if (Math.abs(ndc.x - expectedX) > TOLERANCE || Math.abs(ndc.y - expectedY) > TOLERANCE) {
          sweepFailures++;
          console.error(
            `[shotSolver] composition drift: ${shotSize}/${angle}/${preset.id} expected NDC (${expectedX.toFixed(2)}, ${expectedY.toFixed(2)}) got (${ndc.x.toFixed(2)}, ${ndc.y.toFixed(2)})`
          );
        }
      }
    }
  }
  console.assert(sweepFailures === 0, `[shotSolver] ${sweepFailures} shot-size/angle/composition combinations drifted outside tolerance`);
}
