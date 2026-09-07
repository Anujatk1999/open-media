/**
 * The main cinematic timeline for Motion mode — one card per shot segment,
 * laid out left-to-right on a ruler proportional to each segment's duration
 * (the familiar video-editor mental model), with a playhead tracking
 * `playback.elapsed`. Clicking a card selects it (see ComposerShell's
 * handleSelectSegment): scrubs the playhead to its start and loads its
 * framing back into the Shot Combination panel for editing, which is what
 * makes "selected" distinct from "active" (currently playing, derived from
 * elapsed) below. Reorder is two arrow buttons rather than drag-and-drop:
 * segment order only ever matters relative to its neighbors, and swapping is
 * the whole operation a reorder needs.
 */
import { useComposerStore } from "../../stores/composerStore";
import type { ShotSegment } from "../../stores/composerStore";
import { sequenceDuration, shotSegmentStart } from "./helpers/shotSequence";

const TICK_COUNT = 4;

export function ShotSequenceTimeline({ selectedSegmentId, onSelectSegment }: {
  selectedSegmentId: string | null;
  onSelectSegment: (segment: ShotSegment, start: number) => void;
}) {
  const objects = useComposerStore((s) => s.objects);
  const segments = useComposerStore((s) => s.shotSequence);
  const elapsed = useComposerStore((s) => s.playback.elapsed);
  const updateShotSegment = useComposerStore((s) => s.updateShotSegment);
  const removeShotSegment = useComposerStore((s) => s.removeShotSegment);
  const reorderShotSegments = useComposerStore((s) => s.reorderShotSegments);

  if (segments.length === 0) {
    return <div className="shotseq-empty">No shots yet — build one on the right, then "Add to Timeline".</div>;
  }

  const total = sequenceDuration(segments);

  function move(index: number, dir: -1 | 1) {
    const swapWith = index + dir;
    if (swapWith < 0 || swapWith >= segments.length) return;
    const next = [...segments];
    [next[index], next[swapWith]] = [next[swapWith], next[index]];
    reorderShotSegments(next.map((s) => s.id));
  }

  return (
    <div className="shotseq">
      <div className="shotseq-ruler">
        {Array.from({ length: TICK_COUNT + 1 }, (_, i) => (total / TICK_COUNT) * i).map((t) => (
          <span key={t} className="shotseq-tick" style={{ left: `${total > 0 ? (t / total) * 100 : 0}%` }}>{t.toFixed(1)}s</span>
        ))}
      </div>
      <div className="shotseq-track">
        <div className="shotseq-playhead" style={{ left: `${total > 0 ? (Math.min(elapsed, total) / total) * 100 : 0}%` }} />
        {segments.map((seg, i) => {
          const target = objects.find((o) => o.id === seg.targetId);
          const start = shotSegmentStart(segments, i);
          const isActive = elapsed >= start && elapsed < start + seg.duration;
          const isSelected = seg.id === selectedSegmentId;
          return (
            <div
              key={seg.id}
              className={`shotseq-card${isActive ? " active" : ""}${isSelected ? " selected" : ""}`}
              style={{ left: `${total > 0 ? (start / total) * 100 : 0}%`, width: `${total > 0 ? (seg.duration / total) * 100 : 100}%` }}
              onClick={() => onSelectSegment(seg, start)}
              title={`${target?.name ?? "(deleted)"} — ${seg.shotParams.shotSize}/${seg.shotParams.angle} at ${start.toFixed(1)}s`}
            >
              <span className="shotseq-card-name">{i + 1}. {target?.name ?? "(deleted)"}</span>
              <span className="shotseq-card-meta">{seg.shotParams.shotSize} · {seg.shotParams.angle} · {seg.duration.toFixed(1)}s</span>
              {isSelected && (
                <div className="shotseq-card-controls" onClick={(e) => e.stopPropagation()}>
                  <label>
                    Dur
                    <input
                      type="number" min={0.1} step={0.5} value={seg.duration}
                      onChange={(e) => updateShotSegment(seg.id, { duration: Math.max(0.1, Number(e.target.value)) })}
                    />
                    s
                  </label>
                  <button disabled={i === 0} onClick={() => move(i, -1)} title="Move earlier">◀</button>
                  <button disabled={i === segments.length - 1} onClick={() => move(i, 1)} title="Move later">▶</button>
                  <button onClick={() => removeShotSegment(seg.id)} title="Remove this shot">✕</button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
