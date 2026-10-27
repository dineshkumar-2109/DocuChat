import { useEffect, useRef } from "react";
import { plural } from "./format.js";
import Icon from "./icons.jsx";

export default function SourcesPanel({ open, onClose, selection, hasDoc }) {
  const listRef = useRef();
  const sources = selection?.sources || [];
  const activeRef = selection?.ref;

  // Bring the clicked citation into view.
  useEffect(() => {
    if (!activeRef) return;
    listRef.current?.querySelector(`[data-ref="${activeRef}"]`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [activeRef, selection]);

  return (
    <aside className={`sources drawer-right ${open ? "open" : ""}`} aria-label="Sources">
      <div className="sources-head">
        <h2>Sources</h2>
        <button type="button" className="icon-btn hide-xl" onClick={onClose} aria-label="Close sources"><Icon name="close" /></button>
      </div>
      <p className="sources-caption">
        {sources.length
          ? `${plural(sources.length, "passage")} used for the selected answer, most relevant first.`
          : hasDoc ? "Ask a question to see the passages behind the answer." : "Sources for answers will appear here."}
      </p>

      <ol className="source-list" ref={listRef}>
        {sources.map((s) => {
          const pct = Math.min(100, Math.max(0, Math.round(s.score * 100)));
          return (
            <li key={s.ref} data-ref={s.ref} className={`source ${s.ref === activeRef ? "on" : ""}`}>
              <div className="source-top">
                <span className="source-ref">{s.ref}</span>
                <span className="meter" aria-hidden="true"><i style={{ width: `${Math.max(pct, 3)}%` }} /></span>
                <span className="source-score">{pct > 0 ? `${pct}% match` : "Related passage"}</span>
              </div>
              <p>{s.preview}{s.preview.length >= 300 ? "…" : ""}</p>
            </li>
          );
        })}
      </ol>

      {!sources.length && (
        <div className="sources-empty">
          <Icon name="book" size={22} />
        </div>
      )}
    </aside>
  );
}
