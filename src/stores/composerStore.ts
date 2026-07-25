import { create } from "zustand";

export type ComposerTool = "move" | "rotate" | "pose";

export type CharacterType =
  | "male"
  | "female"
  | "child";

export interface MannequinTransform {
  position: [number, number, number];
  rotation: [number, number, number];
}

export interface MannequinSceneObject {
  id: string;

  name: string;

  type: CharacterType;

  visible: boolean;

  locked: boolean;

  transform: MannequinTransform;

  posture?: { version: number; data: number[][] };
}

interface ComposerState {
  mannequins: MannequinSceneObject[];

  selectedMannequinId: string | null;

  activeTool: ComposerTool;

  addMannequin: (
    type: CharacterType,
  ) => void;

  duplicateSelectedMannequin: () => void;

  deleteSelectedMannequin: () => void;

  duplicateMannequin: (id: string) => void;

  deleteMannequin: (id: string) => void;

  selectMannequin: (
    id: string,
  ) => void;

  clearSelection: () => void;

  renameMannequin: (
    id: string,
    name: string,
  ) => void;

  toggleMannequinVisibility: (
    id: string,
  ) => void;

  toggleMannequinLock: (
    id: string,
  ) => void;

  updateMannequinTransform: (
    id: string,
    transform: Partial<MannequinTransform>,
  ) => void;

  updateMannequinPosture: (
    id: string,
    posture: { version: number; data: number[][] },
  ) => void;

  setActiveTool: (
    tool: ComposerTool,
  ) => void;
}

function createMannequin(
  index: number,
  type: CharacterType,
): MannequinSceneObject {
  return {
    id: crypto.randomUUID(),

    name: `${type.charAt(0).toUpperCase()}${type.slice(
      1,
    )} ${String(index).padStart(2, "0")}`,

    type,

    visible: true,

    locked: false,

    transform: {
      position: [0, 0, 0],

      rotation: [0, 0, 0],
    },
  };
}

const initialMannequin =
  createMannequin(
    1,
    "male",
  );

export const useComposerStore =
  create<ComposerState>(
    (set, get) => ({
      mannequins: [
        initialMannequin,
      ],

      selectedMannequinId:
        initialMannequin.id,

      activeTool: "move",

      addMannequin: (
        type,
      ) => {
        const current =
          get().mannequins;

        const mannequin =
          createMannequin(
            current.length + 1,
            type,
          );

        mannequin.transform.position =
          [
            current.length * 1.5,
            0,
            0,
          ];

        set({
          mannequins: [
            ...current,
            mannequin,
          ],

          selectedMannequinId:
            mannequin.id,
        });
      },

      duplicateSelectedMannequin:
        () => {
          const {
            selectedMannequinId,
          } = get();

          if (!selectedMannequinId) {
            return;
          }

          get().duplicateMannequin(
            selectedMannequinId,
          );
        },
              deleteSelectedMannequin:
        () => {
          const {
            selectedMannequinId,
          } = get();

          if (!selectedMannequinId) {
            return;
          }

          get().deleteMannequin(
            selectedMannequinId,
          );
        },

      duplicateMannequin:
        (id) => {
          const {
            mannequins,
          } = get();

          const source =
            mannequins.find(
              (m) => m.id === id,
            );

          if (!source) {
            return;
          }

          const duplicate: MannequinSceneObject =
            {
              ...source,

              id: crypto.randomUUID(),

              name: `${source.name} Copy`,

              transform: {
                position: [
                  source.transform
                    .position[0] + 1,
                  source.transform
                    .position[1],
                  source.transform
                    .position[2],
                ],

                rotation: [
                  ...source.transform
                    .rotation,
                ] as [
                  number,
                  number,
                  number,
                ],
              },

              posture: source.posture
                  ? { ...source.posture, data: source.posture.data.map(arr => [...arr]) }
                  : undefined,
            };

          set({
            mannequins: [
              ...mannequins,
              duplicate,
            ],

            selectedMannequinId:
              duplicate.id,
          });
        },

      deleteMannequin:
        (id) => {
          const {
            mannequins,
            selectedMannequinId,
          } = get();

          const remaining =
            mannequins.filter(
              (m) => m.id !== id,
            );

          set({
            mannequins:
              remaining,

            selectedMannequinId:
              selectedMannequinId === id
                ? remaining.length > 0
                  ? remaining[0].id
                  : null
                : selectedMannequinId,
          });
        },

      selectMannequin:
        (id) => {
          set({
            selectedMannequinId:
              id,
          });
        },

      clearSelection:
        () => {
          set({
            selectedMannequinId:
              null,
          });
        },

      renameMannequin:
        (
          id,
          name,
        ) => {
          set((state) => ({
            mannequins:
              state.mannequins.map(
                (m) =>
                  m.id === id
                    ? {
                        ...m,
                        name,
                      }
                    : m,
              ),
          }));
        },

      toggleMannequinVisibility:
        (id) => {
          set((state) => ({
            mannequins:
              state.mannequins.map(
                (m) =>
                  m.id === id
                    ? {
                        ...m,
                        visible:
                          !m.visible,
                      }
                    : m,
              ),
          }));
        },

      toggleMannequinLock:
        (id) => {
          set((state) => ({
            mannequins:
              state.mannequins.map(
                (m) =>
                  m.id === id
                    ? {
                        ...m,
                        locked:
                          !m.locked,
                      }
                    : m,
              ),
          }));
        },

      updateMannequinTransform:
        (
          id,
          transform,
        ) => {
          set((state) => ({
            mannequins:
              state.mannequins.map(
                (m) =>
                  m.id === id
                    ? {
                        ...m,

                        transform: {
                          ...m.transform,
                          ...transform,
                        },
                      }
                    : m,
              ),
          }));
        },

      updateMannequinPosture:
        (
          id,
          posture,
        ) => {
          set((state) => ({
            mannequins:
              state.mannequins.map(
                (m) =>
                  m.id === id
                    ? {
                        ...m,
                        posture: { ...posture, data: posture.data.map(arr => [...arr]) },
                      }
                    : m,
              ),
          }));
        },

      setActiveTool:
        (tool) => {
          set({
            activeTool: tool,
          });
        },
    }),
  );