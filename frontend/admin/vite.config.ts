import path from "node:path";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// The backend serves this app under /admin.
export default defineConfig({
  base: "/admin/",
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
  build: { outDir: "dist", emptyOutDir: true, sourcemap: false },
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:8000",
      "/img": "http://localhost:8000",
      "/s/": "http://localhost:8000",
      "/p/": "http://localhost:8000",
    },
  },
});
