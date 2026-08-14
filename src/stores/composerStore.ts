import { create, type StateCreator } from "zustand";
import * as THREE from "three";
import {
  clonePosture,
  describePostureError,
  readPosture,
  writePosture,
  type Posture,
} from "../modules/composer/helpers/posture";
import { groundFigure } from "../modules/composer/helpers/mannequinFactory";

export type ComposerTool = "move" | "rotate" | "scale" | "pose";

export type CharacterType =
  | "male"
  | "female"
  | "child";

export type PrimitiveType =
  | "cube"
  | "plane"
  | "cylinder"
  | "sphere"
  | "capsule"
  | "cone"
  | "torus";

export type ObjectType = CharacterType | PrimitiveType;

export interface SceneTransform {
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
}

export interface SceneObject {
  id: string;
  name: string;
  type: ObjectType;
  visible: boolean;
  locked: boolean;
  transform: SceneTransform;
  posture?: Posture;
  defaultPosture?: Posture;
}

export interface ComposerState {
  objects: SceneObject[];

  selectedObjectId: string | null;

  activeTool: ComposerTool;

  /** Mannequin joint key currently being edited, e.g. "l_elbow". Null when none. */
  selectedJointKey: string | null;

  /** Pose mode sub-mode: the gizmo scales the selected part's shape instead of rotating the joint. */
  partScaleMode: boolean;

  /** Key into MOTIONS while a motion plays, else null. */
  activeMotion: string | null;

  /**
   * Live mannequin-js figures / primitive roots by object id. For mannequins this
   * is the figure itself, not its wrapper group, so `.posture` and `.l_arm` work.
   */
  objectInstances: Map<string, THREE.Object3D>;

  addObject: (type: ObjectType) => void;

  duplicateSelectedObject: () => void;

  deleteSelectedObject: () => void;

  duplicateObject: (id: string) => void;

  deleteObject: (id: string) => void;

  selectObject: (id: string) => void;

  clearSelection: () => void;

  renameObject: (id: string, name: string) => void;

  toggleObjectVisibility: (id: string) => void;

  toggleObjectLock: (id: string) => void;

  updateObjectTransform: (id: string, transform: Partial<SceneTransform>) => void;

  updateObjectPosture: (id: string, posture: Posture) => void;

  updateObjectDefaultPosture: (id: string, posture: Posture) => void;

  setActiveTool: (tool: ComposerTool) => void;

  selectJoint: (key: string | null) => void;

  setPartScaleMode: (on: boolean) => void;

  setActiveMotion: (key: string | null) => void;

  registerObjectInstance: (id: string, object: THREE.Object3D) => void;

  unregisterObjectInstance: (id: string) => void;

  resetObjectTransform: (id: string) => void;

  resetObjectPose: (id: string) => void;

  groundObject: (id: string) => void;

  applyPosture: (id: string, posture: Posture) => void;

  /** Past scene snapshots, oldest first. Empty means nothing to undo. */
  history: SceneObject[][];

  undo: () => void;

  /** Brackets a continuous edit (a gizmo drag) so it lands as one undo step. */
  beginHistoryGroup: () => void;

  endHistoryGroup: () => void;
}

/**
 * Scene history — in memory only, no persistence, no redo.
 *
 * A snapshot is just the previous `objects` array reference. Every mutator here
 * replaces it immutably, so the old reference is already a valid frozen scene and
 * costs nothing to retain: unchanged SceneObjects are shared between snapshots.
 * That is also why history needs no per-action instrumentation — the wrapped
 * `set` below records whenever `objects` changes identity, so anything that edits
 * the scene (transform, posture, add, delete, rename, visibility, lock, joint
 * edits) is covered, including code added later.
 *
 * ponytail: `objects` is the whole history — camera, active tool and selection
 * are deliberately not restored, and there is no redo. Add a full command stack
 * if undo ever needs to cross those.
 */
const HISTORY_LIMIT = 50;

let suppressHistory = false;
let groupDepth = 0;
let groupRecorded = false;

function withoutHistory<T>(fn: () => T): T {
  suppressHistory = true;
  try {
    return fn();
  } finally {
    suppressHistory = false;
  }
}

const withHistory =
  (initializer: StateCreator<ComposerState>): StateCreator<ComposerState> =>
  (set, get, api) => {
    const recordingSet: typeof set = (partial, replace) => {
      const before = get().objects;
      (set as any)(partial, replace);
      if (get().objects === before || suppressHistory) return;

      // A drag records only its pre-drag scene, not every mouse move.
      if (groupDepth > 0) {
        if (groupRecorded) return;
        groupRecorded = true;
      }

      // Touches `history` alone, so this nested call records nothing itself.
      (set as any)({ history: [...get().history, before].slice(-HISTORY_LIMIT) });
    };

    return initializer(recordingSet, get, api);
  };

// Backward-compatible type aliases (can be removed after migration)
export type MannequinSceneObject = SceneObject;
export type MannequinTransform = SceneTransform;

function createObject(
  index: number,
  type: ObjectType,
): SceneObject {
  const baseTransform: SceneTransform = {
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
  };

  let name: string;
  if (isPrimitiveType(type)) {
    name = `${type.charAt(0).toUpperCase()}${type.slice(1)} ${String(index).padStart(2, "0")}`;
  } else {
    name = `${type.charAt(0).toUpperCase()}${type.slice(1)} ${String(index).padStart(2, "0")}`;
  }

  return {
    id: crypto.randomUUID(),
    name,
    type,
    visible: true,
    locked: false,
    transform: baseTransform,
  };
}

function isPrimitiveType(type: ObjectType): type is PrimitiveType {
  return ["cube", "plane", "cylinder", "sphere", "capsule", "cone", "torus"].includes(type);
}

/**
 * Pose editing exists only for mannequins — a primitive has no joints, so leaving
 * Pose active on one shows no gizmo at all and every tool looks dead. Every path
 * that changes the selection or the tool routes through this.
 */
function canPoseSelection(objects: SceneObject[], id: string | null): boolean {
  const target = objects.find((o) => o.id === id);
  return !!target && !isPrimitiveType(target.type);
}

/** True when the current selection supports pose editing. For UI enablement. */
export const selectCanPose = (s: ComposerState) =>
  canPoseSelection(s.objects, s.selectedObjectId);

const initialObject = createObject(1, "male");

export const useComposerStore =
  create<ComposerState>(
    withHistory((set, get) => ({
      objects: [initialObject],

      history: [],

      selectedObjectId: initialObject.id,

      activeTool: "move",

      selectedJointKey: null,

      partScaleMode: false,

      activeMotion: null,

      objectInstances: new Map<string, THREE.Object3D>(),

      addObject: (type) => {
        const current = get().objects;
        const object = createObject(current.length + 1, type);

        object.transform.position = [
          current.length * 1.5,
          0,
          0,
        ];

        set({
          objects: [...current, object],
          selectedObjectId: object.id,
          // A new object must be editable the moment it lands. Move is the tool
          // that applies to both mannequins and primitives, and it is never left
          // in Pose, which a primitive cannot use.
          activeTool: "move",
          selectedJointKey: null,
          partScaleMode: false,
        });
      },

      duplicateSelectedObject: () => {
        const { selectedObjectId } = get();
        if (!selectedObjectId) return;
        get().duplicateObject(selectedObjectId);
      },

      deleteSelectedObject: () => {
        const { selectedObjectId } = get();
        if (!selectedObjectId) return;
        get().deleteObject(selectedObjectId);
      },

      duplicateObject: (id) => {
        const { objects } = get();
        const source = objects.find((o) => o.id === id);
        if (!source) return;

        const duplicate: SceneObject = {
          ...source,
          id: crypto.randomUUID(),
          name: `${source.name} Copy`,
          transform: {
            position: [
              source.transform.position[0] + 1,
              source.transform.position[1],
              source.transform.position[2],
            ],
            rotation: [...source.transform.rotation] as [number, number, number],
            scale: [...source.transform.scale] as [number, number, number],
          },
          posture: source.posture
            ? { ...source.posture, data: source.posture.data.map((arr) => [...arr]) }
            : undefined,
          defaultPosture: source.defaultPosture
            ? { ...source.defaultPosture, data: source.defaultPosture.data.map((arr) => [...arr]) }
            : undefined,
        };

        set({
          objects: [...objects, duplicate],
          selectedObjectId: duplicate.id,
        });
      },

      deleteObject: (id) => {
        const { objects, selectedObjectId, activeTool } = get();
        const remaining = objects.filter((o) => o.id !== id);
        const nextSelected =
          selectedObjectId === id
            ? remaining.length > 0
              ? remaining[0].id
              : null
            : selectedObjectId;

        // Deleting the last mannequin can drop the selection onto a primitive,
        // which cannot stay in Pose without leaving every tool dead.
        const poseStillValid =
          activeTool !== "pose" || canPoseSelection(remaining, nextSelected);

        set({
          objects: remaining,
          selectedObjectId: nextSelected,
          activeTool: poseStillValid ? activeTool : "move",
          selectedJointKey: poseStillValid ? get().selectedJointKey : null,
          partScaleMode: poseStillValid ? get().partScaleMode : false,
        });
      },

      selectObject: (id) => {
        if (get().selectedObjectId === id) return;
        const { objects, activeTool } = get();
        // Clicking a primitive while in Pose falls back to Move, so the click
        // leaves a working gizmo instead of none.
        if (activeTool === "pose" && !canPoseSelection(objects, id)) {
          set({
            selectedObjectId: id,
            selectedJointKey: null,
            activeTool: "move",
            partScaleMode: false,
          });
          return;
        }
        set({ selectedObjectId: id, selectedJointKey: null });
      },

      clearSelection: () => {
        set({ selectedObjectId: null, selectedJointKey: null });
      },

      renameObject: (id, name) => {
        set((state) => ({
          objects: state.objects.map((o) =>
            o.id === id ? { ...o, name } : o
          ),
        }));
      },

      toggleObjectVisibility: (id) => {
        set((state) => ({
          objects: state.objects.map((o) =>
            o.id === id ? { ...o, visible: !o.visible } : o
          ),
        }));
      },

      toggleObjectLock: (id) => {
        set((state) => ({
          objects: state.objects.map((o) =>
            o.id === id ? { ...o, locked: !o.locked } : o
          ),
        }));
      },

      updateObjectTransform: (id, transform) => {
        set((state) => ({
          objects: state.objects.map((o) =>
            o.id === id
              ? {
                  ...o,
                  transform: { ...o.transform, ...transform },
                }
              : o,
          ),
        }));
      },

      updateObjectPosture: (id, posture) => {
        const error = describePostureError(posture);
        if (error) {
          console.error(`[composerStore] rejected posture for ${id}: ${error}`);
          return;
        }
        set((state) => ({
          objects: state.objects.map((o) =>
            o.id === id ? { ...o, posture: clonePosture(posture) } : o,
          ),
        }));
      },

      updateObjectDefaultPosture: (id, posture) => {
        const error = describePostureError(posture);
        if (error) {
          console.error(`[composerStore] rejected default posture for ${id}: ${error}`);
          return;
        }
        // Not an edit: this is the boot posture, captured when the figure finishes
        // loading. Recording it would arm Undo before the user has done anything.
        withoutHistory(() =>
          set((state) => ({
            objects: state.objects.map((o) =>
              o.id === id ? { ...o, defaultPosture: clonePosture(posture) } : o,
            ),
          })),
        );
      },

      setActiveTool: (tool) => {
        // Pose on a primitive is ignored outright, so the working tool stays put
        // rather than switching to one with no gizmo. Covers the P shortcut and
        // both toolbars in one place.
        if (tool === "pose" && !canPoseSelection(get().objects, get().selectedObjectId)) return;

        // Joint editing only exists inside pose mode; leaving it drops the joint
        // selection so the part gizmo cannot outlive the mode that created it.
        if (tool === "pose") set({ activeTool: tool });
        else set({ activeTool: tool, selectedJointKey: null, partScaleMode: false });
      },

      selectJoint: (key) => {
        set({ selectedJointKey: key });
      },

      setPartScaleMode: (on) => {
        set({ partScaleMode: on });
      },

      setActiveMotion: (key) => {
        set({ activeMotion: key });
      },

      registerObjectInstance: (id: string, object: THREE.Object3D) => {
        set((state) => {
          state.objectInstances.set(id, object);
          return state;
        });
      },

      unregisterObjectInstance: (id: string) => {
        set((state) => {
          state.objectInstances.delete(id);
          return state;
        });
      },

      resetObjectTransform: (id: string) => {
        set((state) => ({
          objects: state.objects.map((o) =>
            o.id === id
              ? { ...o, transform: { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] } }
              : o,
          ),
        }));
      },

      /**
       * Restores the posture captured when the figure was built. That boot posture
       * is not all zeros — Male/Female/Child each add their own offsets on top of
       * Mannequin's default — so zeroing joints would not be a reset.
       */
      resetObjectPose: (id: string) => {
        const figure = get().objectInstances.get(id) as any;
        const stored = get().objects.find((o) => o.id === id)?.defaultPosture;
        if (!figure || !stored) return;

        writePosture(figure, stored);
        groundFigure(figure);
        get().updateObjectPosture(id, readPosture(figure));
      },

      /** Re-plants the feet on the ground plane. Never stored — see helpers/posture.ts. */
      groundObject: (id: string) => {
        const figure = get().objectInstances.get(id);
        if (figure) groundFigure(figure);
      },

      /** Applies a library posture to the figure, then grounds it. */
      applyPosture: (id, posture) => {
        const figure = get().objectInstances.get(id) as any;
        get().updateObjectPosture(id, posture);
        if (!figure) return;
        writePosture(figure, posture);
        groundFigure(figure);
      },

      undo: () => {
        const { history, selectedObjectId, selectedJointKey } = get();
        if (history.length === 0) return;

        const previous = history[history.length - 1];
        // The restored scene may predate the selected object, or postdate its
        // deletion; either way the selection has to land on something real.
        const selectionSurvives = previous.some((o) => o.id === selectedObjectId);

        withoutHistory(() =>
          set({
            objects: previous,
            history: history.slice(0, -1),
            selectedObjectId: selectionSurvives
              ? selectedObjectId
              : previous[0]?.id ?? null,
            selectedJointKey: selectionSurvives ? selectedJointKey : null,
          }),
        );
      },

      beginHistoryGroup: () => {
        groupDepth += 1;
        groupRecorded = false;
      },

      endHistoryGroup: () => {
        groupDepth = Math.max(0, groupDepth - 1);
      },
    })),
  );