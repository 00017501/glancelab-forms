import { defineConfig } from "vitest/config";

// The backend serves this app's files under /p/ and its page at /s/{slug}.
export default defineConfig({
  base: "/p/",
  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: false,
  },
  server: {
    port: 5174,
    proxy: {
      "/api": "http://localhost:8000",
      "/img": "http://localhost:8000",
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
