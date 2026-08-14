import { useEffect, useMemo, useState } from "react";
import { useComposerStore, type SceneObject } from "../../stores/composerStore";
import JointControls from "./JointControls";
import { JOINT_CONFIGS, getDOF, setDOF } from "./helpers/jointConfig";
import { mirrorJoint, sideOf } from "./helpers/mirror";
import { MOTIONS } from "./helpers/motion";
import {
  deleteCustomPose,
  loadPoseLibrary,
  saveCustomPose,
  updatePose,
  type PoseEntry,
} from "./helpers/poseLibrary";
import { readPosture } from "./helpers/posture";
import "./PosePanel.css";

/**
 * The mannequin pose editor: library, motions, the selected joint's angles,
 * mirroring and per-part scale.
 *
 * Joint values are read straight off the live figure rather than from a cached
 * map, because the gizmo in the viewport edits the same joints — a cache would
 * be stale the moment a ring is dragged. The stored posture is the render
 * trigger: the gizmo writes it on every change, which re-runs this read.
 */
export default function PosePanel({ character }: { character: SceneObject }) {
  const selectedJointKey = useComposerStore((s) => s.selectedJointKey);
  const partScaleMode = useComposerStore((s) => s.partScaleMode);
  const activeMotion = useComposerStore((s) => s.activeMotion);
  const objectInstances = useComposerStore((s) => s.objectInstances);
  const setPartScaleMode = useComposerStore((s) => s.setPartScaleMode);
  const setActiveMotion = useComposerStore((s) => s.setActiveMotion);
  const updatePosture = useComposerStore((s) => s.updateObjectPosture);
  const applyPosture = useComposerStore((s) => s.applyPosture);
  const groundObject = useComposerStore((s) => s.groundObject);
  const resetObjectPose = useComposerStore((s) => s.resetObjectPose);

  const [library, setLibrary] = useState<PoseEntry[]>([]);
  const [appliedPoseId, setAppliedPoseId] = useState<string | null>(null);
  const [poseName, setPoseName] = useState("");

  const figure = objectInstances.get(character.id) as any;
  const config = JOINT_CONFIGS.find((c) => c.mannequinKey === selectedJointKey) ?? null;
  const locked = character.locked;

  const refreshLibrary = () => loadPoseLibrary().then(setLibrary);
  useEffect(() => { refreshLibrary(); }, []);

  /** Writes the figure's live posture back to the store. */
  const commit = () => {
    if (!figure) return;
    figure.updateMatrixWorld(true);
    updatePosture(character.id, readPosture(figure));
  };

  const values = useMemo(() => {
    const joint = config && figure?.[config.mannequinKey];
    if (!joint) return {};
    return Object.fromEntries(
      config!.dofs.map((dof, i) => [`${config!.mannequinKey}:${i}`, getDOF(joint, dof)]),
    );
    // character.posture is not read here but is what makes gizmo drags refresh.
  }, [config, figure, character.posture]);

  const side = sideOf(selectedJointKey);
  const otherSide = side === "l" ? "Right" : "Left";

  // Save makes a new pose, Update rewrites the one that is loaded — so renaming
  // is how the user says which they meant. An unchanged name with a pose loaded
  // is an Update; a name already on another row would only read as a duplicate.
  const loadedPose = library.find((pose) => pose.id === appliedPoseId) ?? null;
  const newName = poseName.trim();
  const nameTaken = library.some((pose) => pose.name === newName && pose.id !== appliedPoseId);
  const canSave = !!figure && !!newName && !nameTaken && newName !== loadedPose?.name;
  const canUpdate = !!figure && !!loadedPose;

  return (
    <div className="pose-panel">
      <p className="pose-hint">
        Pose tool: click a body part to select its joint, then drag the rings.
      </p>

      <section className="pose-section">
        <p className="section-label">Pose Library</p>
        <div className="pose-library">
          {library.map((pose) => (
            <div className="pose-entry" key={pose.id}>
              <button
                className={`pose-preset-btn${appliedPoseId === pose.id ? " active" : ""}`}
                disabled={locked}
                onClick={() => {
                  setActiveMotion(null);
                  applyPosture(character.id, pose.posture);
                  setAppliedPoseId(pose.id);
                  setPoseName(pose.name);
                }}
              >
                {pose.name}
              </button>
              {pose.source === "custom" && (
                <button
                  className="pose-delete-btn"
                  title="Delete this pose"
                  onClick={() => {
                    deleteCustomPose(pose.id);
                    if (appliedPoseId === pose.id) {
                      setAppliedPoseId(null);
                      setPoseName("");
                    }
                    refreshLibrary();
                  }}
                >
                  ×
                </button>
              )}
            </div>
          ))}
          {library.length === 0 && <p className="pose-hint">No poses found.</p>}
        </div>

        <div className="pose-save-row">
          <input
            className="pose-name-input"
            placeholder="Pose name"
            value={poseName}
            onChange={(e) => setPoseName(e.target.value)}
          />
          <button
            className="inspector-btn"
            title={
              nameTaken
                ? "That name is already in the library"
                : "Add the current posture as a new pose — type a new name first"
            }
            disabled={!canSave}
            onClick={() => {
              const saved = saveCustomPose(newName, readPosture(figure));
              setAppliedPoseId(saved.id);
              setPoseName(saved.name);
              refreshLibrary();
            }}
          >
            Save
          </button>
          <button
            className="inspector-btn"
            title="Overwrite the pose you loaded with the figure's current posture"
            disabled={!canUpdate}
            onClick={() => {
              const updated = updatePose(loadedPose!.id, newName, readPosture(figure));
              setPoseName(updated.name);
              refreshLibrary();
            }}
          >
            Update
          </button>
        </div>
      </section>

      <section className="pose-section">
        <p className="section-label">Motion</p>
        <div className="pose-button-grid">
          {Object.entries(MOTIONS).map(([key, motion]) => (
            <button
              key={key}
              className={`inspector-btn${activeMotion === key ? " on" : ""}`}
              disabled={locked}
              onClick={() => setActiveMotion(activeMotion === key ? null : key)}
            >
              {motion.label}
            </button>
          ))}
        </div>
        <p className="pose-hint">
          Playback is a preview — stopping restores the pose the figure had.
        </p>
      </section>

      <section className="pose-section">
        <div className="pose-button-grid">
          <button className="inspector-btn" onClick={() => groundObject(character.id)}>
            Ground
          </button>
          <button className="inspector-btn" onClick={() => resetObjectPose(character.id)}>
            Reset Pose
          </button>
        </div>
      </section>

      {config && figure ? (
        <section className="pose-section">
          <p className="section-label">{config.label}</p>

          {side && (
            <div className="pose-button-grid">
              <button
                className="inspector-btn"
                disabled={locked}
                onClick={() => { mirrorJoint(figure, selectedJointKey!, true); commit(); }}
              >
                Mirror Limb → {otherSide}
              </button>
              <button
                className="inspector-btn"
                disabled={locked}
                onClick={() => { mirrorJoint(figure, selectedJointKey!, false); commit(); }}
              >
                This Joint → {otherSide}
              </button>
            </div>
          )}

          <JointControls
            only={config.mannequinKey}
            values={values}
            disabled={locked}
            onChange={(cfg, dofIndex, value) => {
              setDOF(figure[cfg.mannequinKey], cfg.dofs[dofIndex], value);
              commit();
            }}
          />

          <JointRotation
            figure={figure}
            jointKey={config.mannequinKey}
            disabled={locked}
            onCommit={commit}
          />

          <button
            className={`inspector-btn${partScaleMode ? " on" : ""}`}
            onClick={() => {
              if (!partScaleMode) setActiveMotion(null);
              setPartScaleMode(!partScaleMode);
            }}
          >
            {partScaleMode ? "Scaling Part" : "Scale Part"}
          </button>
          {partScaleMode && <PartScale figure={figure} jointKey={config.mannequinKey} />}
        </section>
      ) : (
        <p className="pose-hint">No joint selected.</p>
      )}
    </div>
  );
}

const AXES = ["x", "y", "z"] as const;

/**
 * The joint's raw euler in degrees — the prototype's own rotation control, and
 * the same three numbers the gizmo rings drive.
 *
 * The named angles above (raise / straddle / bend / …) are the anatomical subset
 * mannequin-js exposes; an elbow, for instance, only names its bend. The twist
 * that praying hands, crossed arms or a hand in a pocket need has no name, so it
 * is only reachable here. `Posture.extra` is what keeps it through a save.
 */
function JointRotation({
  figure,
  jointKey,
  disabled,
  onCommit,
}: {
  figure: any;
  jointKey: string;
  disabled?: boolean;
  onCommit: () => void;
}) {
  const joint = figure[jointKey];
  if (!joint) return null;

  // The named setters each reorder to suit their own axis, so the euler must be
  // put back in XYZ before its components mean anything. Orientation is unchanged.
  joint.rotation.reorder("XYZ");

  return (
    <div className="pose-scale">
      <p className="section-label">Rotation °</p>
      <div className="number-inputs-row">
        {AXES.map((axis) => (
          <div className="number-input-row" key={axis}>
            <span className="number-input-label">{axis.toUpperCase()}</span>
            <input
              className="number-input"
              type="number"
              step={1}
              disabled={disabled}
              value={Math.round((joint.rotation[axis] * 180) / Math.PI * 10) / 10}
              onChange={(e) => {
                const deg = parseFloat(e.target.value);
                if (!Number.isFinite(deg)) return;
                joint.rotation.reorder("XYZ");
                joint.rotation[axis] = (deg * Math.PI) / 180;
                onCommit();
              }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Scales `joint.image` — the part's own shape. Child joints hang off the
 * joint's `imageWrapper`, so scaling the joint or the wrapper would take the
 * whole limb chain with it.
 *
 * ponytail: part scale is not carried in the v7 posture, so it survives a
 * session but not a saved pose. Storing it needs a field beside `posture`,
 * never a change to the v7 format.
 */
function PartScale({ figure, jointKey }: { figure: any; jointKey: string }) {
  const image = figure[jointKey]?.image;
  const [scale, setScale] = useState<[number, number, number]>([1, 1, 1]);

  useEffect(() => {
    if (image) setScale([image.scale.x, image.scale.y, image.scale.z]);
  }, [image]);

  if (!image) return null;

  const write = (next: [number, number, number]) => {
    image.scale.set(...next);
    figure.updateMatrixWorld(true);
    setScale(next);
  };

  return (
    <div className="pose-scale">
      <div className="number-inputs-row">
        {(["X", "Y", "Z"] as const).map((label, axis) => (
          <div className="number-input-row" key={label}>
            <span className="number-input-label">{label}</span>
            <input
              className="number-input"
              type="number"
              min={0.1}
              step={0.05}
              value={scale[axis]}
              onChange={(e) => {
                const factor = parseFloat(e.target.value);
                if (!Number.isFinite(factor) || factor <= 0) return; // 0 collapses the shape
                const next = [...scale] as [number, number, number];
                next[axis] = factor;
                write(next);
              }}
            />
          </div>
        ))}
      </div>
      <button className="inspector-btn" onClick={() => write([1, 1, 1])}>
        Reset Part Scale
      </button>
    </div>
  );
}
