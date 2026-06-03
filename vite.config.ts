/// <reference types="node" />
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// GitHub Pages serves project sites under /<repo>/. Set base accordingly in CI
// via the VITE_BASE env var; default to "/" for local dev and user/org pages.
const base = process.env.VITE_BASE ?? "/";

export default defineConfig({
  base,
  plugins: [react()],
  worker: {
    format: "es",
  },
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
