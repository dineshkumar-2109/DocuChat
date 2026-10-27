export const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

export function timeAgo(iso) {
  const s = Math.round((Date.now() - new Date(iso)) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return new Date(iso).toLocaleDateString();
}

const extOf = (name) => (name.split(".").pop() || "").toLowerCase();

export const fileType = (name) => {
  const ext = extOf(name);
  if (ext === "pdf") return "pdf";
  if (ext === "md" || ext === "markdown") return "md";
  return "txt";
};

export const fileLabel = (name) => ({ pdf: "PDF", md: "MD", txt: "TXT" })[fileType(name)];
