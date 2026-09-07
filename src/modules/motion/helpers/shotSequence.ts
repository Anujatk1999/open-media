/**
 * Pure helpers for the store's top-level shot sequence (see ShotSegment in
 * composerStore.ts). A segment's start time is deliberately never stored —
 * it's always derived here as the cumulative duration of every segment
 * before it, so reordering/resizing a segment can never desync it from its
 * neighbors.
 */
import type { ShotSegment } from "../../../stores/composerStore";

export function sequenceDuration(segments: ShotSegment[]): number {
  return segments.reduce((sum, s) => sum + s.duration, 0);
}

export function shotSegmentStart(segments: ShotSegment[], index: number): number {
  let start = 0;
  for (let i = 0; i < index; i++) start += segments[i].duration;
  return start;
}

/**
 * The segment active at `elapsed` — holding at the first segment before the
 * sequence starts and the last segment after it ends, mirroring how the
 * "orbit" rig holds at its start/end angle outside its own window.
 */
export function activeShotSegment(segments: ShotSegment[], elapsed: number): ShotSegment | null {
  if (segments.length === 0) return null;
  let start = 0;
  for (const segment of segments) {
    const end = start + segment.duration;
    if (elapsed < end) return segment;
    start = end;
  }
  return segments[segments.length - 1];
}
