import { forwardRef, useEffect, useLayoutEffect, useRef, useState } from "react";
import { api } from "./api.js";
import { fileLabel, fileType, plural, timeAgo } from "./format.js";
import Icon from "./icons.jsx";
import { LogoMark } from "./Logo.jsx";

const SUGGESTIONS = [
  "Summarize this document",
  "What are the key findings?",
  "List the important numbers and dates",
  "What risks or open questions are mentioned?",
];

let nextId = 1;
const withId = (m) => ({ ...m, id: nextId++ });

export default function ChatPanel({ doc, hasDocs, selection, onShowSources, onOpenLibrary, onOpenSources }) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState(false);
  const [question, setQuestion] = useState("");
  const scrollRef = useRef();
  const inputRef = useRef();

  // Load chat history for this document (component is keyed by doc id).
  useEffect(() => {
    if (!doc) return;
    let cancelled = false;
    setLoading(true);
    api(`/api/documents/${doc.id}/messages`)
      .then(({ messages }) => {
        if (cancelled) return;
        const list = messages.map(withId);
        setMessages(list);
        const lastAnswer = [...list].reverse().find((m) => m.role === "assistant" && m.sources?.length);
        if (lastAnswer) onShowSources({ messageId: lastAnswer.id, sources: lastAnswer.sources });
      })
      .catch((err) => !cancelled && setMessages([withId({ role: "error", content: err.message })]))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc?.id]);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, pending]);

  // "/" focuses the question box.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "/" && !/^(INPUT|TEXTAREA)$/.test(document.activeElement?.tagName)) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  async function ask(text) {
    const q = text.trim();
    if (!q || pending || !doc) return;
    setQuestion("");
    setMessages((m) => [...m, withId({ role: "user", content: q })]);
    setPending(true);
    try {
      const res = await api(`/api/documents/${doc.id}/ask`, { method: "POST", json: { question: q } });
      const answer = withId({ role: "assistant", content: res.answer, sources: res.sources, cached: res.cached });
      setMessages((m) => [...m, answer]);
      if (answer.sources?.length) onShowSources({ messageId: answer.id, sources: answer.sources });
    } catch (err) {
      const msg = err.status === 429 ? "You're asking too quickly — wait a moment and try again." : err.message;
      setMessages((m) => [...m, withId({ role: "error", content: msg })]);
    } finally {
      setPending(false);
    }
  }

  if (!doc) return <EmptyState hasDocs={hasDocs} onOpenLibrary={onOpenLibrary} />;

  const sourcesCount = selection?.sources?.length || 0;

  return (
    <section className="chat" aria-label={`Chat about ${doc.name}`}>
      <div className="chat-head">
        <span className={`file-badge lg ${fileType(doc.name)}`}>{fileLabel(doc.name)}</span>
        <div className="chat-head-text">
          <h1 title={doc.name}>{doc.name}</h1>
          <p>{plural(doc.chunk_count, "section")} · added {timeAgo(doc.created_at)}</p>
        </div>
        <button type="button" className="btn btn-outline btn-sm hide-xl" onClick={onOpenSources}>
          <Icon name="book" size={16} />
          <span className="btn-text">Sources</span>
          {sourcesCount > 0 && <span className="count">{sourcesCount}</span>}
        </button>
      </div>

      <div className="messages" ref={scrollRef}>
        <div className="messages-inner">
          {loading && <p className="messages-note">Loading conversation…</p>}
          {!loading && messages.length === 0 && (
            <div className="intro">
              <h2>What would you like to know?</h2>
              <p>Ask anything about <strong>{doc.name}</strong>. Answers come only from this document.</p>
            </div>
          )}
          {messages.map((m) => (
            <Message
              key={m.id}
              message={m}
              selected={selection?.messageId === m.id}
              activeRef={selection?.messageId === m.id ? selection.ref : null}
              onCite={(ref) => onShowSources({ messageId: m.id, sources: m.sources, ref }, { open: true })}
            />
          ))}
          {pending && (
            <div className="msg assistant">
              <span className="msg-avatar"><LogoMark size={28} /></span>
              <div className="msg-body"><span className="typing" aria-label="Thinking"><i /><i /><i /></span></div>
            </div>
          )}
        </div>
      </div>

      <div className="composer-area">
        {!loading && messages.length === 0 && (
          <div className="suggestions">
            {SUGGESTIONS.map((s) => (
              <button key={s} type="button" className="suggestion" onClick={() => ask(s)}>{s}</button>
            ))}
          </div>
        )}
        <form className="composer" onSubmit={(e) => { e.preventDefault(); ask(question); }}>
          <AutoTextarea
            ref={inputRef}
            value={question}
            onChange={setQuestion}
            onSubmit={() => ask(question)}
            placeholder="Ask about this document…"
          />
          <button type="submit" className="send" disabled={!question.trim() || pending} aria-label="Send question">
            <Icon name="send" size={18} />
          </button>
        </form>
        <p className="composer-hint">Press Enter to send, Shift + Enter for a new line.</p>
      </div>
    </section>
  );
}

function Message({ message, selected, activeRef, onCite }) {
  const [copied, setCopied] = useState(false);
  const { role, content, sources, cached } = message;

  if (role === "user") {
    return <div className="msg user"><div className="msg-body">{content}</div></div>;
  }
  if (role === "error") {
    return <div className="msg error"><div className="msg-body"><Icon name="alert" size={16} /> {content}</div></div>;
  }

  const hasSources = sources?.length > 0;
  const parts = content.split(/(\[\d+\])/g);

  async function copy() {
    try { await navigator.clipboard.writeText(content); } catch { /* clipboard unavailable */ }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className={`msg assistant ${selected ? "selected" : ""}`}>
      <span className="msg-avatar"><LogoMark size={28} /></span>
      <div className="msg-main">
        <div className="msg-body">
          {parts.map((p, i) => {
            const m = /^\[(\d+)\]$/.exec(p);
            if (!m || !hasSources) return p;
            const ref = Number(m[1]);
            return (
              <button key={i} type="button" className={`cite ${activeRef === ref ? "on" : ""}`} onClick={() => onCite(ref)} title={`View source ${ref}`}>
                {ref}
              </button>
            );
          })}
        </div>
        <div className="msg-actions">
          {hasSources && (
            <button type="button" className="chip" onClick={() => onCite(sources[0].ref)}>
              <Icon name="book" size={14} /> {plural(sources.length, "source")}
            </button>
          )}
          <button type="button" className="chip" onClick={copy}>
            <Icon name={copied ? "check" : "copy"} size={14} /> {copied ? "Copied" : "Copy"}
          </button>
          {cached && <span className="chip static" title="Answered instantly from a previous identical question"><Icon name="bolt" size={14} /> Instant</span>}
        </div>
      </div>
    </div>
  );
}

const AutoTextarea = forwardRef(function AutoTextarea({ value, onChange, onSubmit, placeholder }, ref) {
  const localRef = useRef();
  const setRefs = (el) => {
    localRef.current = el;
    if (typeof ref === "function") ref(el);
    else if (ref) ref.current = el;
  };

  useLayoutEffect(() => {
    const t = localRef.current;
    if (!t) return;
    t.style.height = "auto";
    t.style.height = `${Math.min(t.scrollHeight, 180)}px`;
    t.style.overflowY = t.scrollHeight > 180 ? "auto" : "hidden";
  }, [value]);

  return (
    <textarea
      ref={setRefs}
      rows={1}
      maxLength={2000}
      value={value}
      placeholder={placeholder}
      aria-label="Question"
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSubmit(); }
      }}
    />
  );
});

function EmptyState({ hasDocs, onOpenLibrary }) {
  return (
    <section className="chat chat-empty">
      <div className="empty">
        <span className="empty-icon"><Icon name="file" size={26} /></span>
        <h1>{hasDocs ? "Choose a document" : "Add your first document"}</h1>
        <p>{hasDocs ? "Select a document from your library to start asking questions." : "Upload a PDF, text or Markdown file. It's ready to chat with in a few seconds."}</p>
        <ol className="how">
          <li><span>1</span>Upload a document</li>
          <li><span>2</span>Wait until it shows <em className="status ready">Ready</em></li>
          <li><span>3</span>Ask anything about it</li>
        </ol>
        <button type="button" className="btn btn-primary hide-lg" onClick={onOpenLibrary}>Open library</button>
      </div>
    </section>
  );
}
