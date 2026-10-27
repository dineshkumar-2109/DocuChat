import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The React app lives in web/ and builds to web/dist, which Express serves.
// In development, `npm run dev:web` proxies API calls to the Express server.
export default defineConfig({
  root: "web",
  plugins: [react()],
  build: { outDir: "dist", emptyOutDir: true },
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:3000",
      "/health": "http://localhost:3000",
    },
  },
});
