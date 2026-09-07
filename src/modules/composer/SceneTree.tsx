import "./SceneTree.css";

export type CharacterType = "male" | "female" | "child";
export type PrimitiveType = "cube" | "plane" | "cylinder" | "sphere" | "capsule" | "cone" | "torus";
export type ObjectType = CharacterType | PrimitiveType | "camera";

export interface SceneObjectData {
  id: string;
  name: string;
  type: ObjectType;
  visible: boolean;
  locked: boolean;
}

interface SceneTreeProps {
  objects: SceneObjectData[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAddCharacter: (type: CharacterType) => void;
  onAddPrimitive: (type: PrimitiveType) => void;
  /** Optional: only the motion editor passes this, so the main composer's SceneTree renders unchanged. */
  onAddCamera?: (type: "camera") => void;
  /** Which camera is the active/viewing camera — motion editor only, drives the CAMERAS section's badge/button. */
  activeCameraId?: string | null;
  onSetActiveCamera?: (id: string) => void;
  onToggleVisibility?: (id: string) => void;
  onToggleLock?: (id: string) => void;
  onDuplicate?: (id: string) => void;
  onDelete?: (id: string) => void;
}

const CHARACTER_TYPES: CharacterType[] = ["male", "female", "child"];
const PRIMITIVE_TYPES: PrimitiveType[] = ["cube", "plane", "cylinder", "sphere", "capsule", "cone", "torus"];

const PRIMITIVE_LABELS: Record<PrimitiveType, string> = {
  cube: "Cube",
  plane: "Plane",
  cylinder: "Cylinder",
  sphere: "Sphere",
  capsule: "Capsule",
  cone: "Cone",
  torus: "Torus",
};

export default function SceneTree({
  objects,
  selectedId,
  onSelect,
  onAddCharacter,
  onAddPrimitive,
  onAddCamera,
  activeCameraId,
  onSetActiveCamera,
  onToggleVisibility,
  onToggleLock,
  onDuplicate,
  onDelete,
}: SceneTreeProps) {
  return (
    <div className="scene-tree">
      {/* CHARACTERS SECTION */}
      <details className="scene-section" open>
        <summary className="scene-section-header">CHARACTERS</summary>
        <div className="scene-section-body">
          <div className="scene-add-buttons">
            {CHARACTER_TYPES.map((type) => (
              <button key={type} onClick={() => onAddCharacter(type)}>
                + {type.charAt(0).toUpperCase() + type.slice(1)}
              </button>
            ))}
          </div>

          <div className="scene-character-list">
            {objects.filter(o => !["cube", "plane", "cylinder", "sphere", "capsule", "cone", "torus", "camera"].includes(o.type)).length === 0 && (
              <div className="scene-empty">No characters</div>
            )}

            {objects
              .filter((o) => !["cube", "plane", "cylinder", "sphere", "capsule", "cone", "torus", "camera"].includes(o.type))
              .map((object) => {
                const isSelected = selectedId === object.id;
                return (
                  <SceneObjectItem
                    key={object.id}
                    object={object}
                    isSelected={isSelected}
                    onSelect={onSelect}
                    onToggleVisibility={onToggleVisibility}
                    onToggleLock={onToggleLock}
                    onDuplicate={onDuplicate}
                    onDelete={onDelete}
                  />
                );
              })}
          </div>
        </div>
      </details>

      {/* PRIMITIVES SECTION */}
      <details className="scene-section" open>
        <summary className="scene-section-header">PRIMITIVES</summary>
        <div className="scene-section-body">
          <div className="scene-add-buttons">
            {PRIMITIVE_TYPES.map((type) => (
              <button key={type} onClick={() => onAddPrimitive(type)}>
                + {PRIMITIVE_LABELS[type]}
              </button>
            ))}
          </div>

          <div className="scene-character-list">
            {objects.filter(o => ["cube", "plane", "cylinder", "sphere", "capsule", "cone", "torus"].includes(o.type)).length === 0 && (
              <div className="scene-empty">No primitives</div>
            )}

            {objects
              .filter((o) => ["cube", "plane", "cylinder", "sphere", "capsule", "cone", "torus"].includes(o.type))
              .map((object) => {
                const isSelected = selectedId === object.id;
                return (
                  <SceneObjectItem
                    key={object.id}
                    object={object}
                    isSelected={isSelected}
                    onSelect={onSelect}
                    onToggleVisibility={onToggleVisibility}
                    onToggleLock={onToggleLock}
                    onDuplicate={onDuplicate}
                    onDelete={onDelete}
                  />
                );
              })}
          </div>
        </div>
      </details>

      {/* CAMERAS SECTION — motion editor only */}
      {onAddCamera && (
        <details className="scene-section" open>
          <summary className="scene-section-header">CAMERAS</summary>
          <div className="scene-section-body">
            <div className="scene-add-buttons">
              <button onClick={() => onAddCamera("camera")}>+ Camera</button>
            </div>

            <div className="scene-character-list">
              {objects.filter((o) => o.type === "camera").length === 0 && (
                <div className="scene-empty">No cameras</div>
              )}

              {objects
                .filter((o) => o.type === "camera")
                .map((object) => {
                  const isSelected = selectedId === object.id;
                  return (
                    <SceneObjectItem
                      key={object.id}
                      object={object}
                      isSelected={isSelected}
                      isActiveCamera={activeCameraId === object.id}
                      onSetActiveCamera={onSetActiveCamera}
                      onSelect={onSelect}
                      onToggleVisibility={onToggleVisibility}
                      onToggleLock={onToggleLock}
                      onDuplicate={onDuplicate}
                      onDelete={onDelete}
                    />
                  );
                })}
            </div>
          </div>
        </details>
      )}
    </div>
  );
}

function SceneObjectItem({
  object,
  isSelected,
  isActiveCamera,
  onSetActiveCamera,
  onSelect,
  onToggleVisibility,
  onToggleLock,
  onDuplicate,
  onDelete,
}: {
  object: SceneObjectData;
  isSelected: boolean;
  isActiveCamera?: boolean;
  onSetActiveCamera?: (id: string) => void;
  onSelect: (id: string) => void;
  onToggleVisibility?: (id: string) => void;
  onToggleLock?: (id: string) => void;
  onDuplicate?: (id: string) => void;
  onDelete?: (id: string) => void;
}) {
  return (
    <div
      className={isSelected ? "scene-item selected" : "scene-item"}
      onClick={() => onSelect(object.id)}
    >
      <div className="scene-item-row">
        <span>{object.name}</span>
        <small>{object.type}</small>
        {isActiveCamera && (
          <small className="scene-item-active-camera" title="Active (viewing/export) camera">
            ● Active
          </small>
        )}
        {object.locked && (
          <small className="scene-item-locked" title="Locked">
            🔒
          </small>
        )}
        {!object.visible && (
          <small className="scene-item-hidden" title="Hidden">
            👁‍🗨
          </small>
        )}
      </div>

      {isSelected && (
        <div className="scene-item-actions">
          {onSetActiveCamera && !isActiveCamera && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onSetActiveCamera(object.id);
              }}
              title="Make this the active/viewing camera"
            >
              Set Active
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleVisibility?.(object.id);
            }}
            title={object.visible ? "Hide" : "Show"}
          >
            {object.visible ? "Hide" : "Show"}
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleLock?.(object.id);
            }}
            title={object.locked ? "Unlock" : "Lock"}
          >
            {object.locked ? "Unlock" : "Lock"}
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDuplicate?.(object.id);
            }}
            title="Duplicate"
          >
            Duplicate
          </button>
          <button
            className="danger"
            onClick={(e) => {
              e.stopPropagation();
              onDelete?.(object.id);
            }}
            title="Delete"
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );
}