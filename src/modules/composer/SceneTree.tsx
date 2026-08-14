import "./SceneTree.css";

export type CharacterType = "male" | "female" | "child";
export type PrimitiveType = "cube" | "plane" | "cylinder" | "sphere" | "capsule" | "cone" | "torus";
export type ObjectType = CharacterType | PrimitiveType;

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
  onToggleVisibility,
  onToggleLock,
  onDuplicate,
  onDelete,
}: SceneTreeProps) {
  return (
    <div className="scene-tree">
      {/* CHARACTERS SECTION */}
      <div className="scene-tree-section">
        <div className="scene-tree-header">
          <h3>CHARACTERS</h3>
          <div className="scene-add-buttons">
            {CHARACTER_TYPES.map((type) => (
              <button key={type} onClick={() => onAddCharacter(type)}>
                + {type.charAt(0).toUpperCase() + type.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div className="scene-character-list">
          {objects.filter(o => !["cube", "plane", "cylinder", "sphere", "capsule", "cone", "torus"].includes(o.type)).length === 0 && (
            <div className="scene-empty">No characters</div>
          )}

          {objects
            .filter((o) => !["cube", "plane", "cylinder", "sphere", "capsule", "cone", "torus"].includes(o.type))
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

      {/* PRIMITIVES SECTION */}
      <div className="scene-tree-section">
        <div className="scene-tree-header">
          <h3>PRIMITIVES</h3>
          <div className="scene-add-buttons">
            {PRIMITIVE_TYPES.map((type) => (
              <button key={type} onClick={() => onAddPrimitive(type)}>
                + {PRIMITIVE_LABELS[type]}
              </button>
            ))}
          </div>
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
    </div>
  );
}

function SceneObjectItem({
  object,
  isSelected,
  onSelect,
  onToggleVisibility,
  onToggleLock,
  onDuplicate,
  onDelete,
}: {
  object: SceneObjectData;
  isSelected: boolean;
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