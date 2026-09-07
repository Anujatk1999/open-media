import { activeShotSegment, sequenceDuration, shotSegmentStart } from "./shotSequence.ts";
import type { ShotSegment } from "../../../stores/composerStore.ts";

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(`shotSequence self-check failed: ${msg}`);
}

const shotParams = {
  shotSize: "medium" as const,
  angle: "front" as const,
  elevation: "eye" as const,
  composition: { id: "center", label: "Center", screenX: 0.5, screenY: 0.5 },
};

const segment = (id: string, duration: number): ShotSegment => ({ id, targetId: "target", shotParams, duration });

const segments = [segment("a", 3), segment("b", 2), segment("c", 4)];

assert(sequenceDuration(segments) === 9, "sequenceDuration should sum every segment's duration");
assert(sequenceDuration([]) === 0, "sequenceDuration of no segments should be 0");

assert(shotSegmentStart(segments, 0) === 0, "the first segment should start at 0");
assert(shotSegmentStart(segments, 1) === 3, "the second segment should start after the first's duration");
assert(shotSegmentStart(segments, 2) === 5, "the third segment should start after the first two's durations");

assert(activeShotSegment([], 0) === null, "no segments means no active segment");
assert(activeShotSegment(segments, -1)?.id === "a", "before the sequence starts should hold at the first segment");
assert(activeShotSegment(segments, 0)?.id === "a", "time 0 should be the first segment");
assert(activeShotSegment(segments, 2.9)?.id === "a", "just before a boundary should still be the earlier segment");
assert(activeShotSegment(segments, 3)?.id === "b", "exactly at a boundary should be the next segment");
assert(activeShotSegment(segments, 4)?.id === "b", "mid-segment should resolve to that segment");
assert(activeShotSegment(segments, 5)?.id === "c", "the second boundary should hand off to the third segment");
assert(activeShotSegment(segments, 9)?.id === "c", "exactly at the end should still be the last segment");
assert(activeShotSegment(segments, 20)?.id === "c", "after the sequence ends should hold at the last segment");

console.log("shotSequence self-check: all assertions passed");
