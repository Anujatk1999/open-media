import type { SceneObject, SceneTransform } from "../../stores/composerStore";
import { useComposerStore } from "../../stores/composerStore";
import PosePanel from "./PosePanel";
import "./Inspector.css";

interface InspectorProps {
  character: SceneObject | null;
  onRename: (id: string, name: string) => void;
  onToggleVisibility: (id: string) => void;
  onToggleLock: (id: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onUpdateTransform: (id: string, transform: Partial<SceneTransform>) => void;
}

export default function Inspector({
  character,
  onRename,
  onToggleVisibility,
  onToggleLock,
  onDuplicate,
  onDelete,
  onUpdateTransform,
}: InspectorProps) {
  const activeTool = useComposerStore((s) => s.activeTool);
  const resetObjectTransform = useComposerStore((s) => s.resetObjectTransform);
  const isPoseMode = activeTool === "pose";
  const isMannequin = character && ["male", "female", "child"].includes(character.type);

  if (!character) {
    return (
      <p className="inspector-empty">
        No object selected.
      </p>
    );
  }

  return (
    <div className="inspector-cards">
      {/* OBJECT CARD */}
      <details className="inspector-card" open>
        <summary className="inspector-card-header">
          <span className="inspector-card-title">Object</span>
        </summary>
        <div className="inspector-card-content">
          <div className="character-header">
            <h3 className="character-name">{character.name}</h3>
            <span className="character-type">
              {character.type.charAt(0).toUpperCase() + character.type.slice(1)}
              {isMannequin ? " mannequin" : " primitive"}
            </span>
          </div>
          <p className="character-id">id: {character.id.slice(0, 8)}…</p>
        </div>
      </details>

      {/* TRANSFORM CARD */}
      <details className="inspector-card">
        <summary className="inspector-card-header">
          <span className="inspector-card-title">Transform</span>
        </summary>
        <div className="inspector-card-content">
          <div className="transform-group">
            <p className="section-label">Position</p>
            <div className="number-inputs-row">
              <NumberInput
                label="X"
                value={character.transform.position[0]}
                step={0.01}
                disabled={character.locked}
                onChange={(v) =>
                  onUpdateTransform(character.id, {
                    position: [v, character.transform.position[1], character.transform.position[2]],
                  })
                }
              />
              <NumberInput
                label="Y"
                value={character.transform.position[1]}
                step={0.01}
                disabled={character.locked}
                onChange={(v) =>
                  onUpdateTransform(character.id, {
                    position: [character.transform.position[0], v, character.transform.position[2]],
                  })
                }
              />
              <NumberInput
                label="Z"
                value={character.transform.position[2]}
                step={0.01}
                disabled={character.locked}
                onChange={(v) =>
                  onUpdateTransform(character.id, {
                    position: [character.transform.position[0], character.transform.position[1], v],
                  })
                }
              />
            </div>
          </div>

          <div className="transform-group">
            <p className="section-label">Rotation</p>
            <div className="number-inputs-row">
              <NumberInput
                label="X"
                value={radToDeg(character.transform.rotation[0])}
                step={0.1}
                disabled={character.locked}
                onChange={(v) =>
                  onUpdateTransform(character.id, {
                    rotation: [degToRad(v), character.transform.rotation[1], character.transform.rotation[2]],
                  })
                }
              />
              <NumberInput
                label="Y"
                value={radToDeg(character.transform.rotation[1])}
                step={0.1}
                disabled={character.locked}
                onChange={(v) =>
                  onUpdateTransform(character.id, {
                    rotation: [character.transform.rotation[0], degToRad(v), character.transform.rotation[2]],
                  })
                }
              />
              <NumberInput
                label="Z"
                value={radToDeg(character.transform.rotation[2])}
                step={0.1}
                disabled={character.locked}
                onChange={(v) =>
                  onUpdateTransform(character.id, {
                    rotation: [character.transform.rotation[0], character.transform.rotation[1], degToRad(v)],
                  })
                }
              />
            </div>
          </div>

          <div className="transform-group">
            <p className="section-label">Scale</p>
            <div className="number-inputs-row">
              <NumberInput
                label="X"
                value={character.transform.scale[0]}
                step={0.01}
                disabled={character.locked}
                onChange={(v) =>
                  onUpdateTransform(character.id, {
                    scale: [v, character.transform.scale[1], character.transform.scale[2]],
                  })
                }
              />
              <NumberInput
                label="Y"
                value={character.transform.scale[1]}
                step={0.01}
                disabled={character.locked}
                onChange={(v) =>
                  onUpdateTransform(character.id, {
                    scale: [character.transform.scale[0], v, character.transform.scale[2]],
                  })
                }
              />
              <NumberInput
                label="Z"
                value={character.transform.scale[2]}
                step={0.01}
                disabled={character.locked}
                onChange={(v) =>
                  onUpdateTransform(character.id, {
                    scale: [character.transform.scale[0], character.transform.scale[1], v],
                  })
                }
              />
            </div>
          </div>

          <button
            className="inspector-btn"
            onClick={() => resetObjectTransform(character.id)}
          >
            Reset Transform
          </button>
        </div>
      </details>

      {/* POSE CARD - only for mannequins */}
      {isMannequin && (
        <details className="inspector-card" open>
          <summary className="inspector-card-header">
            <span className="inspector-card-title">Pose</span>
          </summary>
          <div className="inspector-card-content">
            {!isPoseMode && (
              <p className="pose-hint">
                Switch to <b>Pose</b> tool mode to select joints in the viewport.
              </p>
            )}
            <PosePanel character={character} />
          </div>
        </details>
      )}

      {/* STATUS CARD */}
      <details className="inspector-card">
        <summary className="inspector-card-header">
          <span className="inspector-card-title">Status</span>
        </summary>
        <div className="inspector-card-content">
          <div className="status-list">
            <p className="status-item">
              <span className="status-dot" style={{ color: character.visible ? "#d6ff53" : "#ff6b6b" }}>&bull;</span>
              {character.visible ? "Visible" : "Hidden"}
            </p>
            <p className="status-item">
              <span className="status-dot" style={{ color: character.locked ? "#d6ff53" : "#ff6b6b" }}>&bull;</span>
              {character.locked ? "Locked" : "Unlocked"}
            </p>
            <p className="status-item">
              <span className="status-dot" style={{ color: isPoseMode ? "#d6ff53" : "#ff6b6b" }}>&bull;</span>
              {isPoseMode ? "Pose Mode" : "Transform Mode"}
            </p>
          </div>
          <div className="inspector-actions">
            <button
              className="inspector-btn"
              onClick={() => onToggleVisibility(character.id)}
            >
              {character.visible ? "Hide" : "Show"}
            </button>
            <button
              className="inspector-btn"
              onClick={() => onToggleLock(character.id)}
            >
              {character.locked ? "Unlock" : "Lock"}
            </button>
            <button
              className="inspector-btn"
              onClick={() => onDuplicate(character.id)}
            >
              Duplicate
            </button>
            <button
              className="inspector-btn danger"
              onClick={() => onDelete(character.id)}
            >
              Delete
            </button>
          </div>
        </div>
      </details>
    </div>
  );
}

function NumberInput({
  label,
  value,
  step,
  disabled,
  onChange,
}: {
  label: string;
  value: number;
  step: number;
  disabled?: boolean;
  onChange: (v: number) => void;
}) {
  return (
    <div className="number-input-row">
      <span className="number-input-label">{label}</span>
      <input
        className="number-input"
        type="number"
        value={parseFloat(value.toFixed(step < 1 ? 2 : 1))}
        step={step}
        disabled={disabled}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
      />
    </div>
  );
}

function radToDeg(r: number): number {
  return (r * 180) / Math.PI;
}

function degToRad(d: number): number {
  return (d * Math.PI) / 180;
}