/// <reference types="vite/client" />
/**
 * Shot Composer Library — the library.html landing page. A Shot Deck-style
 * discovery UI: compact hero, a sticky horizontal category strip, a search
 * bar, and one scrollable card grid fed entirely by getAllLibraryEntries()
 * (static shots + saved motion scenes + — later — community scenes, see
 * modules/library/model/). No per-combination files, no hardcoded counts:
 * everything renders off whatever the unified model returns, so it scales to
 * however many entries exist without code changes here.
 *
 * Card actions only cover what already works today (static-shot Preview)
 * plus a plain "Open in Motion Editor" link for saved motion scenes —
 * loading a specific saved scene into the editor, and a real community
 * backend, are both explicitly out of scope for this pass.
 */
import { useEffect, useMemo, useState } from "react";
import { assertShotSolverBasics, type ShotParams } from "./shotSolver";
import { assertShotLibrarySize } from "./shotLibraryData";
import { COMPOSITION_PRESETS, DEFAULT_COMPOSITION_PRESET } from "./compositionPresets";
import { ANGLE_OPTIONS, SHOT_SIZE_OPTIONS } from "./shotAxes";
import { ShotThumbnail, PoseThumbnail } from "./ShotThumbnail";
import {
  getAllLibraryEntries,
  getPoseLibraryEntries,
  LIBRARY_CATEGORIES,
  type LibraryCategory,
  type LibraryEntry,
} from "../model";

/** Pose Library / Motion Library are whole sources (see LibraryEntry.source), not category tags — they get their own filter branch below rather than an entry in LIBRARY_CATEGORIES. */
type CategoryFilter = "all" | LibraryCategory | "pose-library" | "motion-library";

/** The top-level nav, in the exact order requested. Camera Movement is deliberately absent as a top-level tab — a saved camera motion still shows up inside Motion Library. */
const NAV_ITEMS: { id: CategoryFilter; label: string }[] = [
  { id: "composition", label: "Composition" },
  { id: "cameraAngle", label: "Camera Angle" },
  { id: "pose-library", label: "Pose Library" },
  { id: "motion-library", label: "Motion Library" },
  { id: "community", label: "Community" },
];

/** Categories that browse by a specific axis *value* (Front, Full, Left Third…) rather than just tagging "has this axis". */
const AXIS_VALUES: Partial<Record<LibraryCategory, { id: string; label: string }[]>> = {
  composition: COMPOSITION_PRESETS.map((p) => ({ id: p.id, label: p.label })),
  shotSize: SHOT_SIZE_OPTIONS.map(([id, label]) => ({ id, label })),
  cameraAngle: ANGLE_OPTIONS.map(([id, label]) => ({ id, label })),
};

const DEFAULT_PARAMS: ShotParams = {
  shotSize: "full",
  angle: "front",
  elevation: "eye",
  composition: DEFAULT_COMPOSITION_PRESET,
};

const PAGE_SIZE = 60;

function motionUrl(assetId: string, autoplay: boolean): string {
  const search = new URLSearchParams({ mode: "motion", applyMotion: assetId });
  if (autoplay) search.set("autoplay", "1");
  return `/composer?${search.toString()}`;
}

function poseUrl(poseId: string): string {
  return `/composer?${new URLSearchParams({ applyPose: poseId }).toString()}`;
}

function composerUrl(params: ShotParams): string {
  const search = new URLSearchParams({
    shotSize: params.shotSize,
    angle: params.angle,
    elevation: params.elevation,
    composition: params.composition.id,
  });
  return `/composer?${search.toString()}`;
}

function categoryLabel(id: LibraryCategory): string {
  return LIBRARY_CATEGORIES.find((c) => c.id === id)?.label ?? id;
}

const rootStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  overflowY: "auto",
  background: "radial-gradient(circle at top, #1b2126, #101316)",
  color: "#e6e9eb",
  fontFamily: "system-ui, sans-serif",
};

const pageInnerStyle: React.CSSProperties = { maxWidth: 1200, margin: "0 auto", padding: "18px 32px 64px" };

const heroStyle: React.CSSProperties = { display: "flex", alignItems: "center", gap: 16, marginBottom: 14 };

const heroThumbWrapStyle: React.CSSProperties = { width: 120, height: 68, flexShrink: 0 };

const heroTitleStyle: React.CSSProperties = { fontSize: 19, fontWeight: 700, margin: "0 0 3px", letterSpacing: -0.3 };

const heroSubtitleStyle: React.CSSProperties = { fontSize: 12.5, opacity: 0.55, lineHeight: 1.45, margin: 0, maxWidth: 480 };

const navBarStyle: React.CSSProperties = {
  position: "sticky",
  top: 0,
  zIndex: 5,
  background: "#14181cee",
  backdropFilter: "blur(6px)",
  border: "1px solid #262d32",
  borderRadius: 10,
  boxShadow: "0 6px 16px rgba(0,0,0,.25)",
  padding: "9px 12px",
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  gap: 12,
  marginBottom: 14,
}

const tabsRowStyle: React.CSSProperties = {
  display: "flex",
  gap: 6,
  overflowX: "auto",
  flex: "1 1 320px",
  paddingBottom: 2,
};

const tabButtonStyle: React.CSSProperties = {
  flex: "0 0 auto",
  padding: "6px 12px",
  borderRadius: 999,
  fontSize: 12,
  color: "#c7ced1",
  background: "#1d2226",
  border: "1px solid #2b3238",
  cursor: "pointer",
  whiteSpace: "nowrap",
};

const tabButtonActiveStyle: React.CSSProperties = {
  ...tabButtonStyle,
  color: "#0f1113",
  background: "#6fb7ff",
  border: "1px solid #6fb7ff",
  fontWeight: 600,
};

const searchInputStyle: React.CSSProperties = {
  flex: "0 1 240px",
  padding: "7px 12px",
  borderRadius: 8,
  border: "1px solid #2b3238",
  background: "#1a1f23",
  color: "inherit",
  fontSize: 12.5,
  outline: "none",
};

const resultsMetaStyle: React.CSSProperties = { fontSize: 11.5, opacity: 0.45, margin: "0 0 10px", textTransform: "uppercase", letterSpacing: 0.4 };

const cardGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
  gap: 16,
  alignItems: "start",
};

const browseCardStyle: React.CSSProperties = {
  background: "linear-gradient(160deg, #1c2226 0%, #15181b 100%)",
  border: "1px solid #262d32",
  borderRadius: 12,
  padding: 12,
  display: "flex",
  flexDirection: "column",
  gap: 8,
};

const cardThumbWrapStyle: React.CSSProperties = { width: "100%" };

const cardTitleStyle: React.CSSProperties = {
  fontSize: 12.5,
  lineHeight: 1.4,
  opacity: 0.9,
  minHeight: "2.8em",
  display: "-webkit-box",
  WebkitLineClamp: 2,
  WebkitBoxOrient: "vertical",
  overflow: "hidden",
};

const cardTagsStyle: React.CSSProperties = { display: "flex", flexWrap: "wrap", gap: 4, height: 20, overflow: "hidden" };

const tagChipStyle: React.CSSProperties = {
  fontSize: 10,
  padding: "2px 7px",
  borderRadius: 999,
  background: "#23282c",
  color: "#98a3a6",
  border: "1px solid #2b3238",
};

const cardActionsStyle: React.CSSProperties = { display: "flex", gap: 6, marginTop: "auto" };

const actionButtonStyle: React.CSSProperties = {
  flex: 1,
  padding: "7px 6px",
  fontSize: 11,
  borderRadius: 6,
  border: "1px solid #333c42",
  background: "#1a1f23",
  color: "inherit",
  cursor: "pointer",
};

const primaryActionButtonStyle: React.CSSProperties = { ...actionButtonStyle, border: "1px solid #6fb7ff", background: "#26405a" };

const placeholderThumbStyle = (height: number): React.CSSProperties => ({
  height,
  borderRadius: 8,
  background: "linear-gradient(160deg, #23282c 0%, #171b1e 100%)",
  border: "1px solid #262d32",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 11,
  color: "#6fb7ff",
  opacity: 0.85,
});

/** Real per-value tags (e.g. "Full", "3/4 Left") for static shots; the entry's own category for poses/motions; generic category chips for everything else. */
function entryTags(entry: LibraryEntry): string[] {
  if (entry.source === "static-shot") {
    const { shotSizeLabel, angleLabel, elevationLabel, composition } = entry.data;
    return [shotSizeLabel, angleLabel, elevationLabel, composition.label];
  }
  if (entry.source === "pose") return [entry.data.category];
  if (entry.source === "motion") {
    return [entry.data.category || "Uncategorized", entry.data.objectType === "camera" ? "Camera Movement" : "Character Motion"];
  }
  return entry.categories.map(categoryLabel);
}

function EntryThumbnail({ entry }: { entry: LibraryEntry }) {
  if (entry.source === "static-shot") {
    return (
      <div style={cardThumbWrapStyle}>
        <ShotThumbnail params={entry.data.params} width={220} height={124} cacheKey={entry.id} />
      </div>
    );
  }
  if (entry.source === "motion-scene") {
    const count = entry.data.objects.length;
    return (
      <div style={placeholderThumbStyle(124)}>
        Motion Scene · {count} object{count === 1 ? "" : "s"} · {entry.data.duration}s
      </div>
    );
  }
  if (entry.source === "pose") {
    return (
      <div style={cardThumbWrapStyle}>
        <PoseThumbnail posture={entry.data.posture} width={220} height={124} cacheKey={entry.id} />
      </div>
    );
  }
  if (entry.source === "motion") {
    const count = entry.data.keyframes.length;
    return (
      <div style={placeholderThumbStyle(124)}>
        Motion · {count} keyframe{count === 1 ? "" : "s"} · {entry.data.duration}s
      </div>
    );
  }
  return <div style={placeholderThumbStyle(124)}>Community Scene</div>;
}

function EntryActions({ entry }: { entry: LibraryEntry }) {
  if (entry.source === "static-shot") {
    return (
      <button type="button" style={primaryActionButtonStyle} onClick={() => window.open(composerUrl(entry.data.params), "_blank")}>
        Preview
      </button>
    );
  }
  if (entry.source === "motion-scene") {
    return (
      <button type="button" style={primaryActionButtonStyle} onClick={() => window.open("/composer?mode=motion", "_blank")}>
        Open in Motion Editor
      </button>
    );
  }
  if (entry.source === "pose") {
    return (
      <button type="button" style={primaryActionButtonStyle} onClick={() => window.open(poseUrl(entry.data.id), "_blank")}>
        Open in Composer
      </button>
    );
  }
  if (entry.source === "motion") {
    return (
      <>
        <button type="button" style={actionButtonStyle} onClick={() => window.open(motionUrl(entry.data.id, true), "_blank")}>
          Preview
        </button>
        <button type="button" style={primaryActionButtonStyle} onClick={() => window.open(motionUrl(entry.data.id, false), "_blank")}>
          Apply
        </button>
      </>
    );
  }
  return (
    <button type="button" style={actionButtonStyle} disabled title="Community scenes are coming soon">
      Coming Soon
    </button>
  );
}

function LibraryCard({ entry }: { entry: LibraryEntry }) {
  return (
    <div style={browseCardStyle}>
      <EntryThumbnail entry={entry} />
      <div style={cardTitleStyle}>{entry.title}</div>
      <div style={cardTagsStyle}>
        {entryTags(entry).slice(0, 3).map((tag) => (
          <span key={tag} style={tagChipStyle}>{tag}</span>
        ))}
      </div>
      <div style={cardActionsStyle}>
        <EntryActions entry={entry} />
      </div>
    </div>
  );
}

export function ShotLibraryPage() {
  const [entries, setEntries] = useState<LibraryEntry[]>(() => getAllLibraryEntries());
  const [activeCategory, setActiveCategory] = useState<CategoryFilter>("all");
  const [activeValue, setActiveValue] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  useEffect(() => {
    if (import.meta.env.DEV) {
      assertShotSolverBasics();
      assertShotLibrarySize();
    }
  }, []);

  // Poses load async (poseLibrary.ts fetches bundled JSON), so they arrive a
  // render after the rest of the sync sources and get appended in.
  useEffect(() => {
    getPoseLibraryEntries().then((poseEntries) => setEntries((prev) => [...prev, ...poseEntries]));
  }, []);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [activeCategory, activeValue, query]);

  const isLibraryTab = activeCategory === "pose-library" || activeCategory === "motion-library";
  const axisValues = !isLibraryTab && activeCategory !== "all" ? AXIS_VALUES[activeCategory] : undefined;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return entries.filter((entry) => {
      if (activeCategory === "pose-library" && entry.source !== "pose") return false;
      if (activeCategory === "motion-library" && entry.source !== "motion") return false;
      if (!isLibraryTab && activeCategory !== "all" && !entry.categories.includes(activeCategory)) return false;
      if (activeValue && entry.source === "static-shot") {
        if (activeCategory === "composition" && entry.data.composition.id !== activeValue) return false;
        if (activeCategory === "cameraAngle" && entry.data.angle !== activeValue) return false;
      }
      if (q && !entry.title.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [entries, activeCategory, activeValue, isLibraryTab, query]);

  const visible = filtered.slice(0, visibleCount);

  return (
    <div style={rootStyle}>
      <div style={pageInnerStyle}>
        <div style={heroStyle}>
          <div style={heroThumbWrapStyle}>
            <ShotThumbnail params={DEFAULT_PARAMS} width={160} height={90} />
          </div>
          <div>
            <h1 style={heroTitleStyle}>Shot Composer Library</h1>
            <p style={heroSubtitleStyle}>
              500+ camera setups across every composition, shot size and angle, plus saved scenes and — soon —
              community shots. Growing as more movements and scenes are added.
            </p>
          </div>
        </div>

        <div style={navBarStyle}>
          <div style={tabsRowStyle}>
            <button
              type="button"
              style={activeCategory === "all" ? tabButtonActiveStyle : tabButtonStyle}
              onClick={() => { setActiveCategory("all"); setActiveValue(null); }}
            >
              All
            </button>
            {NAV_ITEMS.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                style={activeCategory === id ? tabButtonActiveStyle : tabButtonStyle}
                onClick={() => { setActiveCategory(id); setActiveValue(null); }}
              >
                {label}
              </button>
            ))}
          </div>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search titles…"
            style={searchInputStyle}
          />
        </div>

        {axisValues && (
          <div style={tabsRowStyle}>
            <button
              type="button"
              style={activeValue === null ? tabButtonActiveStyle : tabButtonStyle}
              onClick={() => setActiveValue(null)}
            >
              All {categoryLabel(activeCategory as LibraryCategory)}
            </button>
            {axisValues.map((v) => (
              <button
                key={v.id}
                type="button"
                style={activeValue === v.id ? tabButtonActiveStyle : tabButtonStyle}
                onClick={() => setActiveValue(v.id)}
              >
                {v.label}
              </button>
            ))}
          </div>
        )}

        <p style={resultsMetaStyle}>{filtered.length} result{filtered.length === 1 ? "" : "s"}</p>

        <div style={cardGridStyle}>
          {visible.map((entry) => (
            <LibraryCard key={entry.id} entry={entry} />
          ))}
        </div>

        {visible.length === 0 && <p style={{ opacity: 0.6, fontSize: 13 }}>No entries match your filters.</p>}

        {visibleCount < filtered.length && (
          <div style={{ display: "flex", justifyContent: "center", padding: "24px 0" }}>
            <button type="button" style={{ ...actionButtonStyle, flex: "0 0 auto", padding: "9px 20px" }} onClick={() => setVisibleCount((v) => v + PAGE_SIZE)}>
              Load more ({filtered.length - visibleCount} remaining)
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
