import { useRef } from "react";
import { useComposerStore } from "../../stores/composerStore";

export function Timeline() {
  const selectedObjectId = useComposerStore((s) => s.selectedObjectId);
  const objects = useComposerStore((s) => s.objects);
  const selectedKeyframeId = useComposerStore((s) => s.selectedKeyframeId);
  const duration = useComposerStore((s) => s.playback.duration);
  const elapsed = useComposerStore((s) => s.playback.elapsed);
  const selectKeyframe = useComposerStore((s) => s.selectKeyframe);
  const addKeyframe = useComposerStore((s) => s.addKeyframe);
  const deleteKeyframe = useComposerStore((s) => s.deleteKeyframe);
  const moveKeyframeTime = useComposerStore((s) => s.moveKeyframeTime);
  const beginHistoryGroup = useComposerStore((s) => s.beginHistoryGroup);
  const endHistoryGroup = useComposerStore((s) => s.endHistoryGroup);

  const trackRef = useRef<HTMLDivElement>(null);
  const object = objects.find((o) => o.id === selectedObjectId) ?? null;

  function timeAt(clientX: number): number {
    const track = trackRef.current;
    if (!track) return 0;
    const rect = track.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    return ratio * duration;
  }

  function handleTrackDoubleClick(e: React.MouseEvent) {
    if (!object) return;
    addKeyframe(object.id, timeAt(e.clientX));
  }

  function handleMarkerPointerDown(e: React.PointerEvent, keyframeId: string) {
    if (!object) return;
    e.stopPropagation();
    beginHistoryGroup();
    const onMove = (ev: PointerEvent) => moveKeyframeTime(object.id, keyframeId, timeAt(ev.clientX));
    const onUp = () => {
      endHistoryGroup();
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  if (!object) {
    return <div style={{ padding: 12, opacity: 0.6, fontSize: 13 }}>Select an object to see its keyframes.</div>;
  }

  const selectedKeyframe = object.keyframes.find((k) => k.id === selectedKeyframeId);

  return (
    <div style={{ padding: "14px 24px", background: "var(--panel)", borderTop: "1px solid var(--border)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
        <span style={{ fontSize: 12, opacity: 0.7 }}>{object.name ?? object.id} — {object.keyframes.length} keyframe(s)</span>
        {selectedKeyframe && object.keyframes.length > 1 && (
          <button onClick={() => deleteKeyframe(object.id, selectedKeyframe.id)}>Delete Keyframe</button>
        )}
      </div>
      <div
        ref={trackRef}
        onDoubleClick={handleTrackDoubleClick}
        style={{ position: "relative", height: 24, background: "#0d0f13", borderRadius: 4, cursor: "copy" }}
      >
        <div
          style={{
            position: "absolute", top: 0, bottom: 0, left: `${duration > 0 ? (elapsed / duration) * 100 : 0}%`,
            width: 1, background: "#e8e8e8", pointerEvents: "none",
          }}
        />
        {object.keyframes.map((kf) => (
          <div
            key={kf.id}
            onPointerDown={(e) => handleMarkerPointerDown(e, kf.id)}
            onClick={(e) => { e.stopPropagation(); selectKeyframe(kf.id); }}
            title={`${kf.time.toFixed(2)}s`}
            style={{
              position: "absolute", top: "50%", left: `${duration > 0 ? (kf.time / duration) * 100 : 0}%`,
              width: 10, height: 10, marginLeft: -5, marginTop: -5,
              background: kf.id === selectedKeyframeId ? "#f87171" : "#4ade80",
              transform: "rotate(45deg)", cursor: "grab",
            }}
          />
        ))}
      </div>
    </div>
  );
}
