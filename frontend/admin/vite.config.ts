import path from "node:path";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Where the dev server forwards API, image and participant requests. Docker Compose points it at the backend service.
const backendUrl = process.env.BACKEND_URL ?? "http://localhost:8000";
// File-change events do not always reach a container from the host, so Docker Compose turns polling on.
const watch = process.env.WATCH_POLLING === "true" ? { usePolling: true, interval: 300 } : undefined;

// The backend serves this app under /admin.
export default defineConfig({
  base: "/admin/",
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
  build: { outDir: "dist", emptyOutDir: true, sourcemap: false },
  server: {
    port: 5173,
    watch,
    proxy: {
      "/api": backendUrl,
      "/img": backendUrl,
      "/s/": backendUrl,
      "/p/": backendUrl,
    },
  },
});
