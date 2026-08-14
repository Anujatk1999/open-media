import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useComposerStore } from "../../stores/composerStore";
import { createMotion, MOTIONS } from "./helpers/motion";
import { loadPoseLibrary } from "./helpers/poseLibrary";
import { groundFigure } from "./helpers/mannequinFactory";
import { readPosture, writePosture, type Posture } from "./helpers/posture";

/**
 * Plays the active motion on the selected figure.
 *
 * The prototype hung its cycle off mannequin-js's `stage.animationLoop`; this
 * app has no stage, so the same job is done from R3F's frame loop.
 *
 * Frames are never written to the store. A motion is a preview, so stopping
 * restores exactly the posture the figure had when Play was pressed rather than
 * leaving an unsaved edit replaced by a mid-stride frame.
 */
export default function MotionPlayer() {
  const activeMotion = useComposerStore((s) => s.activeMotion);
  const selectedId = useComposerStore((s) => s.selectedObjectId);
  const objectInstances = useComposerStore((s) => s.objectInstances);

  const cycle = useRef<((elapsed: number) => Posture) | null>(null);
  const startedAt = useRef<number | null>(null);

  useEffect(() => {
    cycle.current = null;
    startedAt.current = null;

    const motion = activeMotion ? MOTIONS[activeMotion] : null;
    const figure = selectedId ? (objectInstances.get(selectedId) as any) : null;
    if (!motion || !figure) return;

    const resting = readPosture(figure);
    let cancelled = false;

    (async () => {
      // Walk and Run ride a saved pose; the rest nudge whatever the figure is
      // already standing in.
      const pose = motion.poseId
        ? (await loadPoseLibrary()).find((p) => p.id === motion.poseId)
        : null;
      if (cancelled) return;
      if (motion.poseId && !pose) {
        console.warn(`[MotionPlayer] no pose "${motion.poseId}" to animate`);
        return;
      }
      cycle.current = createMotion(figure, motion, pose ? pose.posture : resting);
    })();

    return () => {
      cancelled = true;
      cycle.current = null;
      writePosture(figure, resting);
      groundFigure(figure);
    };
  }, [activeMotion, selectedId, objectInstances]);

  useFrame(({ clock }) => {
    if (!cycle.current || !selectedId) return;
    const figure = objectInstances.get(selectedId) as any;
    if (!figure) return;
    if (startedAt.current === null) startedAt.current = clock.elapsedTime;
    figure.posture = cycle.current(clock.elapsedTime - startedAt.current);
    groundFigure(figure); // stride height changes; keeps the feet planted
  });

  return null;
}
