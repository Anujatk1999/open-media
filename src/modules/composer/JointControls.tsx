import { JOINT_CONFIGS, type JointConfig, type JointDOF } from "./helpers/jointConfig";
import "./JointControls.css";

interface JointControlsProps {
  /** Current values map: "jointKey:dofIndex" -> number */
  values: Record<string, number>;
  /** Called when a slider changes */
  onChange: (config: JointConfig, dofIndex: number, value: number) => void;
  /** Whether controls should be disabled */
  disabled?: boolean;
  /** Show only this joint key, expanded. Omit for the full body list. */
  only?: string;
}

const isFinger = (config: JointConfig) => config.mannequinKey.includes("_finger_");

export default function JointControls({ values, onChange, disabled, only }: JointControlsProps) {
  const sections = (side: "l" | "r") =>
    JOINT_CONFIGS.filter((c) => isFinger(c) && c.mannequinKey.startsWith(`${side}_`));

  if (only) {
    const config = JOINT_CONFIGS.find((c) => c.mannequinKey === only);
    if (!config) return null;
    return (
      <div className="joint-controls">
        <JointSection config={config} values={values} onChange={onChange} disabled={disabled} open />
      </div>
    );
  }

  return (
    <div className="joint-controls">
      {JOINT_CONFIGS.filter((c) => !isFinger(c)).map((config) => (
        <JointSection
          key={config.mannequinKey}
          config={config}
          values={values}
          onChange={onChange}
          disabled={disabled}
        />
      ))}
      {(["l", "r"] as const).map((side) => (
        <details className="joint-section" key={side} open={false}>
          <summary className="joint-section-header">
            {side === "l" ? "Left Hand" : "Right Hand"}
          </summary>
          <div className="joint-subsections">
            {sections(side).map((config) => (
              <JointSection
                key={config.mannequinKey}
                config={config}
                values={values}
                onChange={onChange}
                disabled={disabled}
              />
            ))}
          </div>
        </details>
      ))}
    </div>
  );
}

function JointSection({
  config,
  values,
  onChange,
  disabled,
  open = false,
}: {
  config: JointConfig;
  values: Record<string, number>;
  onChange: (config: JointConfig, dofIndex: number, value: number) => void;
  disabled?: boolean;
  open?: boolean;
}) {
  return (
    <details className="joint-section" open={open}>
      <summary className="joint-section-header">{config.label}</summary>
      <div className="joint-dofs">
        {config.dofs.map((dof, idx) => {
          const key = `${config.mannequinKey}:${idx}`;
          const val = values[key] ?? 0;
          return (
            <JointSlider
              key={key}
              dof={dof}
              value={val}
              disabled={disabled}
              onChange={(v) => onChange(config, idx, v)}
            />
          );
        })}
      </div>
    </details>
  );
}

function JointSlider({
  dof,
  value,
  disabled,
  onChange,
}: {
  dof: JointDOF;
  value: number;
  disabled?: boolean;
  onChange: (v: number) => void;
}) {
  // mannequin-js accessors are already degrees, as are dof.min/max/step —
  // slider and number input share them directly, no conversion.
  return (
    <div className="joint-slider-row">
      <span className="joint-slider-label">{dof.label}</span>
      <div className="joint-slider-track">
        <input
          type="range"
          className="joint-slider"
          min={dof.min}
          max={dof.max}
          step={dof.step}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(parseFloat(e.target.value))}
        />
        <div
          className="joint-slider-fill"
          style={{ width: `${((value - dof.min) / (dof.max - dof.min)) * 100}%` }}
        />
      </div>
      <JointNumberInput
        value={value}
        min={dof.min}
        max={dof.max}
        step={dof.step}
        disabled={disabled}
        onChange={onChange}
      />
    </div>
  );
}

function JointNumberInput({
  value,
  min,
  max,
  step,
  disabled,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  step: number;
  disabled?: boolean;
  onChange: (v: number) => void;
}) {
  return (
    <input
      type="number"
      className="joint-number-input"
      value={parseFloat(value.toFixed(step < 1 ? 2 : 1))}
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      onChange={(e) => {
        const val = parseFloat(e.target.value);
        if (!isNaN(val)) onChange(val);
      }}
      onKeyDown={(e) => {
        if (e.key === "ArrowUp") {
          e.preventDefault();
          const newVal = Math.min(max, value + step);
          onChange(newVal);
        } else if (e.key === "ArrowDown") {
          e.preventDefault();
          const newVal = Math.max(min, value - step);
          onChange(newVal);
        }
      }}
    />
  );
}