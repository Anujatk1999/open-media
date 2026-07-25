import { JOINT_CONFIGS, type JointConfig, type JointDOF } from "./helpers/jointConfig";

interface JointControlsProps {
  /** Current values map: "jointKey:dofIndex" -> number */
  values: Record<string, number>;
  /** Called when a slider changes */
  onChange: (config: JointConfig, dofIndex: number, value: number) => void;
  /** Whether controls should be disabled */
  disabled?: boolean;
}

export default function JointControls({ values, onChange, disabled }: JointControlsProps) {
  return (
    <div className="joint-controls">
      {JOINT_CONFIGS.map((config) => (
        <JointSection
          key={config.mannequinKey}
          config={config}
          values={values}
          onChange={onChange}
          disabled={disabled}
        />
      ))}
    </div>
  );
}

function JointSection({
  config,
  values,
  onChange,
  disabled,
}: {
  config: JointConfig;
  values: Record<string, number>;
  onChange: (config: JointConfig, dofIndex: number, value: number) => void;
  disabled?: boolean;
}) {
  return (
    <details className="joint-section" open={false}>
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
  const pct = ((value - dof.min) / (dof.max - dof.min)) * 100;

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
          style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
        />
      </div>
      <span className="joint-slider-value">{value.toFixed(dof.step < 1 ? 1 : 0)}°</span>
    </div>
  );
}