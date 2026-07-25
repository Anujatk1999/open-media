import type { MannequinSceneObject, MannequinTransform } from "../../stores/composerStore";
import { useComposerStore } from "../../stores/composerStore";
import JointControls from "./JointControls";

interface InspectorProps {
  character: MannequinSceneObject | null;
  onRename: (id: string, name: string) => void;
  onToggleVisibility: (id: string) => void;
  onToggleLock: (id: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onUpdateTransform: (id: string, transform: Partial<MannequinTransform>) => void;
  jointValues?: Record<string, number>;
  onJointChange?: (configKey: string, dofIndex: number, value: number) => void;
}

export default function Inspector({
  character,
  onRename,
  onToggleVisibility,
  onToggleLock,
  onDuplicate,
  onDelete,
  onUpdateTransform,
  jointValues,
  onJointChange,
}: InspectorProps) {
  const activeTool = useComposerStore((s) => s.activeTool);
  const isPoseMode = activeTool === "pose";

  if (!character) {
    return (
      <p className="muted" style={{ fontSize: 12 }}>
        No character selected.
      </p>
    );
  }

  return (
    <>
      <section>
        <h3>{character.name.toUpperCase()}</h3>
        <p className="muted">
          {character.type.charAt(0).toUpperCase() + character.type.slice(1)} mannequin
        </p>
        <p className="muted" style={{ fontSize: 10, opacity: 0.6 }}>
          id: {character.id.slice(0, 8)}…
        </p>
      </section>

      <section>
        <h3>NAME</h3>
        <input
          className="inspector-input"
          value={character.name}
          onChange={(e) => onRename(character.id, e.target.value)}
        />
      </section>

      <section>
        <h3>TRANSFORM</h3>
        <p className="section-label">POSITION</p>
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
        <p className="section-label">ROTATION</p>
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
      </section>

      <section>
        <h3>STATUS</h3>
        <p className="status">● {character.visible ? "Visible" : "Hidden"}</p>
        <p className="status">● {character.locked ? "Locked" : "Unlocked"}</p>
        <p className="status">● {isPoseMode ? "Pose Mode" : "Transform Mode"}</p>
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
      </section>

      <section>
        <h3>POSE</h3>
        {isPoseMode ? (
          <p className="muted" style={{ fontSize: 11, lineHeight: 1.5 }}>
            In Pose Mode, click a body part in the viewport to select a joint, then drag to rotate it.
          </p>
        ) : (
          <p className="muted" style={{ fontSize: 11, lineHeight: 1.5 }}>
            Switch to <b>Pose</b> tool mode to edit joints in the viewport by clicking and dragging body parts.
          </p>
        )}
        <details style={{ marginTop: 8 }}>
          <summary style={{ fontSize: 10, color: '#758085', cursor: 'pointer', userSelect: 'none' }}>
            Fine-adjust sliders
          </summary>
          <div style={{ marginTop: 6 }}>
            <JointControls
              values={jointValues ?? {}}
              onChange={(config, dofIndex, value) => {
                onJointChange?.(config.mannequinKey, dofIndex, value);
              }}
              disabled={character.locked}
            />
          </div>
        </details>
      </section>
    </>
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