import { config } from "../config/index.js";

/**
 * Split text into overlapping chunks. Tries to break on sentence
 * boundaries near the chunk size so chunks stay readable.
 */
export function chunkText(
  text,
  chunkSize = config.limits.chunkSize,
  overlap = config.limits.chunkOverlap
) {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return [];

  const chunks = [];
  let start = 0;

  while (start < clean.length) {
    let end = Math.min(start + chunkSize, clean.length);

    // Try to end on a sentence boundary within the last 200 chars.
    if (end < clean.length) {
      const slice = clean.slice(start, end);
      const lastBreak = Math.max(
        slice.lastIndexOf(". "),
        slice.lastIndexOf("! "),
        slice.lastIndexOf("? ")
      );
      if (lastBreak > 0 && lastBreak > chunkSize - 200) {
        end = start + lastBreak + 1;
      }
    }

    const chunk = clean.slice(start, end).trim();
    if (chunk) chunks.push(chunk);

    if (end === clean.length) break;
    // Always move forward, even if overlap >= the chunk just produced.
    start = end - overlap > start ? end - overlap : end;
  }

  return chunks;
}
