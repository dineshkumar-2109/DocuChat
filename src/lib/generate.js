import Anthropic from "@anthropic-ai/sdk";
import { config } from "../config/index.js";

const anthropic = new Anthropic({ apiKey: config.anthropic.apiKey });

const SYSTEM_PROMPT =
  "You are a helpful assistant answering questions about a specific document. " +
  "Use ONLY the provided context to answer. If the answer is not contained in " +
  "the context, say you don't have enough information in this document. " +
  "When you use a piece of context, cite it with its [number].";

/**
 * Generate a grounded answer from retrieved context chunks.
 * matches: Pinecone matches with metadata.text
 */
export async function generateAnswer(question, matches) {
  const context = matches
    .map((m, i) => `[${i + 1}] ${m.metadata?.text ?? ""}`)
    .join("\n\n");

  const message = await anthropic.messages.create({
    model: config.anthropic.model,
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Context:\n${context}\n\nQuestion: ${question}`,
      },
    ],
  });

  const text = message.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("");

  return text;
}
