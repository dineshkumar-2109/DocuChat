import { useRef, useState } from "react";
import { api } from "./api.js";
import { useToast } from "./toast.jsx";
import { fileLabel, fileType, plural, timeAgo } from "./format.js";
import Icon from "./icons.jsx";

const STATUS_LABEL = { ready: "Ready", processing: "Indexing", failed: "Failed" };
const MAX_UPLOAD_MB = 4; // matches the server default (Vercel caps request bodies at 4.5 MB)

export default function Sidebar({ open, onClose, docs, loaded, activeId, onSelect, onDelete, onUploaded }) {
  const toast = useToast();
  const inputRef = useRef();
  const [filter, setFilter] = useState("");
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(null);

  async function upload(file) {
    if (!file) return;
    if (file.size > MAX_UPLOAD_MB * 1024 * 1024) {
      toast(`That file is larger than ${MAX_UPLOAD_MB} MB. Try a smaller one.`, "error");
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    setUploading(file.name);
    try {
      const form = new FormData();
      form.append("file", file);
      const doc = await api("/api/documents", { method: "POST", form });
      toast(`“${doc.name}” uploaded — indexing now`);
      onUploaded();
    } catch (err) {
      toast(err.status === 413 ? `That file is larger than ${MAX_UPLOAD_MB} MB.` : err.message, "error");
    } finally {
      setUploading(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  const q = filter.trim().toLowerCase();
  const visible = docs.filter((d) => d.name.toLowerCase().includes(q));

  return (
    <aside className={`sidebar drawer-left ${open ? "open" : ""}`} aria-label="Library">
      <div className="drawer-head hide-lg">
        <h2>Library</h2>
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Close library"><Icon name="close" /></button>
      </div>

      <label
        className={`dropzone ${dragging ? "dragging" : ""} ${uploading ? "busy" : ""}`}
        tabIndex={0}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); upload(e.dataTransfer.files[0]); }}
      >
        <input ref={inputRef} type="file" hidden accept=".pdf,.txt,.md,application/pdf,text/plain,text/markdown" onChange={(e) => upload(e.target.files[0])} />
        <span className="dropzone-icon">{uploading ? <span className="spinner" /> : <Icon name="upload" />}</span>
        <span className="dropzone-text">
          <strong>{uploading ? "Uploading…" : "Upload a document"}</strong>
          <span>{uploading || `PDF, TXT or Markdown · up to ${MAX_UPLOAD_MB} MB`}</span>
        </span>
      </label>

      {docs.length > 0 && (
        <div className="search">
          <Icon name="search" size={16} />
          <input type="search" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Search documents" aria-label="Search documents" />
        </div>
      )}

      <div className="list-head">
        <h2>Documents</h2>
        {docs.length > 0 && <span className="count">{docs.length}</span>}
      </div>

      <ul className="doc-list">
        {visible.map((d) => {
          const ready = d.status === "ready";
          return (
            <li key={d.id}>
              <div
                className={`doc ${d.id === activeId ? "active" : ""} ${ready ? "" : "disabled"}`}
                role="button"
                tabIndex={ready ? 0 : -1}
                aria-disabled={!ready}
                aria-current={d.id === activeId}
                title={d.status === "failed" ? d.error : d.name}
                onClick={() => ready && onSelect(d.id)}
                onKeyDown={(e) => e.key === "Enter" && ready && onSelect(d.id)}
              >
                <span className={`file-badge ${fileType(d.name)}`}>{fileLabel(d.name)}</span>
                <span className="doc-text">
                  <span className="doc-name">{d.name}</span>
                  <span className="doc-meta">
                    <span className={`status ${d.status}`}>{STATUS_LABEL[d.status]}</span>
                    <span className="doc-meta-text">
                      {ready ? `${plural(d.chunk_count, "section")} · ${timeAgo(d.created_at)}` : d.status === "failed" ? d.error : timeAgo(d.created_at)}
                    </span>
                  </span>
                </span>
                <button
                  type="button"
                  className="doc-delete"
                  aria-label={`Delete ${d.name}`}
                  title="Delete"
                  onClick={(e) => { e.stopPropagation(); onDelete(d); }}
                >
                  <Icon name="trash" size={16} />
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      {loaded && docs.length === 0 && (
        <div className="list-empty">
          <Icon name="file" size={22} />
          <p>No documents yet.<br />Upload one to get started.</p>
        </div>
      )}
      {docs.length > 0 && visible.length === 0 && <p className="list-empty small">No documents match “{filter}”.</p>}
    </aside>
  );
}
