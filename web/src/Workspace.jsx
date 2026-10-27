import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "./api.js";
import { useToast } from "./toast.jsx";
import Icon from "./icons.jsx";
import Logo from "./Logo.jsx";
import ThemeToggle from "./ThemeToggle.jsx";
import Sidebar from "./Sidebar.jsx";
import ChatPanel from "./ChatPanel.jsx";
import SourcesPanel from "./SourcesPanel.jsx";

export default function Workspace({ user, onSignOut, theme, onToggleTheme }) {
  const toast = useToast();
  const [docs, setDocs] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [activeId, setActiveId] = useState(null);
  const [drawer, setDrawer] = useState(null); // "library" | "sources" | null
  const [selection, setSelection] = useState(null); // { messageId, sources, ref }
  const pollTimer = useRef();

  const loadDocs = useCallback(async () => {
    try {
      const { documents } = await api("/api/documents");
      setDocs(documents);
      setLoaded(true);
      clearTimeout(pollTimer.current);
      // Keep polling while anything is still being indexed.
      if (documents.some((d) => d.status === "processing")) {
        pollTimer.current = setTimeout(loadDocs, 2000);
      }
    } catch (err) {
      if (err.status !== 401) toast(err.message, "error");
    }
  }, [toast]);

  useEffect(() => {
    loadDocs();
    return () => clearTimeout(pollTimer.current);
  }, [loadDocs]);

  // Esc closes drawers.
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && setDrawer(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const activeDoc = docs.find((d) => d.id === activeId) || null;

  function selectDoc(id) {
    setActiveId(id);
    setSelection(null);
    setDrawer(null);
  }

  async function deleteDoc(doc) {
    if (!window.confirm(`Delete “${doc.name}”?\n\nThis removes the document and its chat history.`)) return;
    try {
      await api(`/api/documents/${doc.id}`, { method: "DELETE" });
      if (doc.id === activeId) { setActiveId(null); setSelection(null); }
      toast("Document deleted");
      loadDocs();
    } catch (err) {
      toast(err.message, "error");
    }
  }

  function showSources(sel, { open } = {}) {
    setSelection(sel);
    if (open) setDrawer("sources");
  }

  return (
    <div className="workspace">
      <header className="topbar">
        <div className="topbar-start">
          <button type="button" className="icon-btn hide-lg" onClick={() => setDrawer("library")} aria-label="Open library">
            <Icon name="menu" />
          </button>
          <Logo />
        </div>
        <div className="topbar-end">
          <ThemeToggle theme={theme} onToggle={onToggleTheme} />
          <span className="account" title={user.email}>
            <span className="avatar" aria-hidden="true">{user.email.charAt(0).toUpperCase()}</span>
            <span className="account-email">{user.email}</span>
          </span>
          <button type="button" className="btn btn-quiet" onClick={onSignOut} aria-label="Sign out">
            <Icon name="logout" size={17} />
            <span className="btn-text">Sign out</span>
          </button>
        </div>
      </header>

      <div className="panes">
        <Sidebar
          open={drawer === "library"}
          onClose={() => setDrawer(null)}
          docs={docs}
          loaded={loaded}
          activeId={activeId}
          onSelect={selectDoc}
          onDelete={deleteDoc}
          onUploaded={loadDocs}
        />

        <ChatPanel
          key={activeId || "none"}
          doc={activeDoc}
          hasDocs={docs.length > 0}
          selection={selection}
          onShowSources={showSources}
          onOpenLibrary={() => setDrawer("library")}
          onOpenSources={() => setDrawer("sources")}
        />

        <SourcesPanel
          open={drawer === "sources"}
          onClose={() => setDrawer(null)}
          selection={selection}
          hasDoc={!!activeDoc}
        />
      </div>

      {drawer && <div className="scrim" onClick={() => setDrawer(null)} />}
    </div>
  );
}
