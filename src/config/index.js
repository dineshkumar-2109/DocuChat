import "dotenv/config";

function required(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

export const config = {
  env: process.env.NODE_ENV || "development",
  port: parseInt(process.env.PORT || "3000", 10),

  jwtSecret: required("JWT_SECRET"),

  databaseUrl: required("DATABASE_URL"),

  cache: {
    answerTtl: parseInt(process.env.ANSWER_CACHE_TTL || "86400", 10),
  },

  pinecone: {
    apiKey: required("PINECONE_API_KEY"),
    index: process.env.PINECONE_INDEX || "docuchat",
  },

  openai: {
    apiKey: required("OPENAI_API_KEY"),
    embeddingModel: process.env.EMBEDDING_MODEL || "text-embedding-3-small",
    embeddingDim: parseInt(process.env.EMBEDDING_DIM || "1536", 10),
  },

  anthropic: {
    apiKey: required("ANTHROPIC_API_KEY"),
    model: process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5",
  },

  limits: {
    // Vercel caps request bodies at 4.5 MB, so the default stays under it.
    maxUploadBytes: parseFloat(process.env.MAX_UPLOAD_MB || "4") * 1024 * 1024,
    chunkSize: parseInt(process.env.CHUNK_SIZE || "1000", 10),
    chunkOverlap: parseInt(process.env.CHUNK_OVERLAP || "200", 10),
  },
};
