import OpenAI from "openai";
import { config } from "../config/index.js";

const openai = new OpenAI({ apiKey: config.openai.apiKey });

const BATCH_SIZE = 96; // OpenAI allows large batches; keep it safe.

/**
 * Embed an array of strings, batching to respect API limits.
 * Returns an array of embedding vectors in the same order.
 */
export async function embed(texts) {
  const input = Array.isArray(texts) ? texts : [texts];
  const vectors = [];

  for (let i = 0; i < input.length; i += BATCH_SIZE) {
    const batch = input.slice(i, i + BATCH_SIZE);
    const res = await openai.embeddings.create({
      model: config.openai.embeddingModel,
      input: batch,
    });
    for (const d of res.data) vectors.push(d.embedding);
  }

  return vectors;
}

export async function embedOne(text) {
  const [vec] = await embed(text);
  return vec;
}
