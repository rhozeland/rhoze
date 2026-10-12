import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { readFileSync, writeFileSync } from "node:fs";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), mode === "development" && componentTagger(), {
    name: "mirror-discover-entry",
    closeBundle() {
      // The nested static address must use the same built scripts/styles as the Vite entry.
      const html = readFileSync(path.resolve(__dirname, "dist/discover.html"), "utf8");
      writeFileSync(path.resolve(__dirname, "dist/discover/index.html"), html);
    },
  }].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, "index.html"),
        team: path.resolve(__dirname, "team.html"),
        start: path.resolve(__dirname, "start.html"),
        invest: path.resolve(__dirname, "invest.html"),
        create: path.resolve(__dirname, "create.html"),
        discover: path.resolve(__dirname, "discover.html"),
        pitch: path.resolve(__dirname, "pitch.html"),
      },
    },
  },
}));
