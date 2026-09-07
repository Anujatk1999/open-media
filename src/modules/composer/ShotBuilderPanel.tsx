/**
 * The redesigned right-panel "Shot" tab: a live preview plus one icon row per
 * axis (Shot Size, Camera Angle, Elevation, Composition). Every click updates
 * `params` and, through it, the preview — there is no separate Apply button.
 * Reuses the same ShotParams/solveShot/describeShot the Library already
 * established; this panel only supplies a friendlier UI on top, never a
 * second copy of the shot math.
 */
import type { ShotParams } from "../library/calibration/shotSolver";
import { ANGLE_OPTIONS, ELEVATION_OPTIONS, SHOT_SIZE_OPTIONS } from "../library/calibration/shotAxes";
import { COMPOSITION_PRESETS } from "../library/calibration/compositionPresets";
import { AngleIcon, CompositionIcon, ElevationIcon, ShotSizeIcon } from "./ShotBuilderIcons";
import { ShotPreview } from "./ShotPreview";
import * as THREE from "three";

export const SHOT_PREVIEW_WIDTH = 260;
export const SHOT_PREVIEW_HEIGHT = 146;

export function ShotBuilderPanel({
  params,
  onChange,
  scene,
  camera,
  canCompose,
  onAddToTimeline,
  editingSegmentLabel,
  onUpdateSegment,
  onCancelEdit,
}: {
  params: ShotParams;
  onChange: (next: ShotParams) => void;
  scene: THREE.Scene | null;
  camera: THREE.Camera | null;
  canCompose: boolean;
  /** Motion mode only: appends the current shot params (framing the current selection) as a new segment on the sequence camera. Omit to hide the button (e.g. in Static, which has its own shot strip). */
  onAddToTimeline?: () => void;
  /** Set once a Shot Sequence card is selected for editing (see ShotSequenceTimeline) — swaps the action button from "add" to "update this segment" and labels which shot is currently loaded. */
  editingSegmentLabel?: string | null;
  onUpdateSegment?: () => void;
  onCancelEdit?: () => void;
}) {
  if (!canCompose) {
    return (
      <p className="shotbuilder-empty">
        Select an object in the scene to compose a shot for it.
      </p>
    );
  }

  return (
    <div className="shotbuilder">
      <ShotBuilderRow label="Shot Size">
        {SHOT_SIZE_OPTIONS.map(([id, label]) => (
          <OptionButton key={id} label={label} active={params.shotSize === id} onClick={() => onChange({ ...params, shotSize: id })}>
            <ShotSizeIcon shotSize={id} />
          </OptionButton>
        ))}
      </ShotBuilderRow>

      <ShotBuilderRow label="Camera Angle">
        {ANGLE_OPTIONS.map(([id, label]) => (
          <OptionButton key={id} label={label} active={params.angle === id} onClick={() => onChange({ ...params, angle: id })}>
            <AngleIcon angle={id} />
          </OptionButton>
        ))}
      </ShotBuilderRow>

      <ShotBuilderRow label="Elevation">
        {ELEVATION_OPTIONS.map(([id, label]) => (
          <OptionButton key={id} label={label} active={params.elevation === id} onClick={() => onChange({ ...params, elevation: id })}>
            <ElevationIcon elevation={id} />
          </OptionButton>
        ))}
      </ShotBuilderRow>

      <ShotBuilderRow label="Composition">
        {COMPOSITION_PRESETS.map((preset) => (
          <OptionButton
            key={preset.id}
            label={preset.label}
            active={params.composition.id === preset.id}
            onClick={() => onChange({ ...params, composition: preset })}
          >
            <CompositionIcon composition={preset} />
          </OptionButton>
        ))}
      </ShotBuilderRow>

      <ShotPreview scene={scene} camera={camera} width={SHOT_PREVIEW_WIDTH} height={SHOT_PREVIEW_HEIGHT} />

      {onAddToTimeline && (
        editingSegmentLabel ? (
          <div className="shotbuilder-editing-actions">
            <button type="button" className="composer-add-shot-btn primary" onClick={onUpdateSegment} title="Save these changes to the selected shot">
              Update Segment
            </button>
            <button type="button" className="composer-add-shot-btn" onClick={onCancelEdit} title="Stop editing this segment">
              Cancel
            </button>
          </div>
        ) : (
          <button type="button" className="composer-add-shot-btn primary" onClick={onAddToTimeline} title="Append this framing as a new shot on the sequence camera">
            + Add to Timeline
          </button>
        )
      )}

      {onAddToTimeline && (
        <div className="shotbuilder-current">
          {editingSegmentLabel ? `Editing: ${editingSegmentLabel}` : "Drafting a new shot — not yet on the timeline"}
        </div>
      )}
    </div>
  );
}

function ShotBuilderRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="shotbuilder-row">
      <div className="shotbuilder-row-label">{label}</div>
      <div className="shotbuilder-options">{children}</div>
    </div>
  );
}

function OptionButton({
  label,
  active,
  onClick,
  children,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button type="button" className={`shotbuilder-opt${active ? " active" : ""}`} onClick={onClick} title={label}>
      {children}
      <span>{label}</span>
    </button>
  );
}
