/// <reference types="node" />
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";

// `vite build --mode singlefile` (or SINGLE_FILE=1) produces ONE self-contained
// dist-single/index.html with all JS and CSS inlined — double-click to open, no
// server needed (great for locked-down machines). Otherwise a normal multi-file
// build for GitHub Pages.
export default defineConfig(({ mode }) => {
  const singleFile = mode === "singlefile" || process.env.SINGLE_FILE === "1";

  // GitHub Pages serves project sites under /<repo>/. Set base accordingly in CI
  // via the VITE_BASE env var; default to "/" for local dev and user/org pages.
  const base = singleFile ? "./" : process.env.VITE_BASE ?? "/";

  return {
    base,
    plugins: [react(), ...(singleFile ? [viteSingleFile()] : [])],
    worker: { format: "es" },
    build: singleFile ? { outDir: "dist-single", assetsInlineLimit: 100_000_000 } : {},
    test: {
      globals: true,
      environment: "node",
      include: ["src/**/*.test.ts"],
    },
  };
});
