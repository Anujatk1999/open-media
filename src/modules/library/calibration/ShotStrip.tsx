import { useState } from "react";
import type { ShotLibraryEntry } from "./shotLibraryData";

interface Props {
  shots: ShotLibraryEntry[];
  onSelect: (entry: ShotLibraryEntry) => void;
  onRemove: (id: string) => void;
  /** Extra control rendered in the toggle row, e.g. an "Add Current Shot" button — kept out of this component so callers decide what "current" means. */
  headerExtra?: React.ReactNode;
}

/**
 * Flows in normal layout rather than overlaying — the Composer docks it in a
 * dedicated flex row at the page bottom, and an absolutely-positioned bar
 * here would fight that wrapper for the same screen real estate as the
 * viewport's own workspace-toolbar overlay.
 */
const barStyle: React.CSSProperties = {
  background: "rgba(21, 25, 29, 0.95)",
  borderTop: "1px solid #3c464b",
  color: "#e6e9eb",
  fontFamily: "system-ui, sans-serif",
  fontSize: 12,
};

const toggleRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "6px 12px",
  cursor: "pointer",
  userSelect: "none",
};

const stripRowStyle: React.CSSProperties = {
  display: "flex",
  gap: 8,
  padding: "0 12px 10px",
  overflowX: "auto",
};

const chipStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  flex: "0 0 auto",
  padding: "6px 8px",
  borderRadius: 4,
  border: "1px solid #3c464b",
  background: "#1e2327",
  whiteSpace: "nowrap",
  cursor: "pointer",
};

export function ShotStrip({ shots, onSelect, onRemove, headerExtra }: Props) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div style={barStyle}>
      <div style={toggleRowStyle}>
        <span style={{ cursor: "pointer", flex: 1 }} onClick={() => setExpanded((v) => !v)}>
          Shot Strip ({shots.length})
        </span>
        {headerExtra}
        <span style={{ opacity: 0.6, cursor: "pointer" }} onClick={() => setExpanded((v) => !v)}>
          {expanded ? "Collapse ▾" : "Expand ▸"}
        </span>
      </div>
      {expanded && (
        <div style={stripRowStyle}>
          {shots.length === 0 && <span style={{ opacity: 0.5, padding: "4px 0" }}>No shots added yet — use "Add" on a card.</span>}
          {shots.map((entry) => (
            <div key={entry.id} style={chipStyle} onClick={() => onSelect(entry)}>
              <span>{entry.label}</span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove(entry.id);
                }}
                style={{ background: "none", border: "none", color: "#e6e9eb", cursor: "pointer", opacity: 0.6 }}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
