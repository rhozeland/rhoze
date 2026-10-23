import { defineConfig, type ViteDevServer } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
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
    configureServer(server: ViteDevServer) {
      server.middlewares.use((req, _res, next) => {
        if (req.url && /^\/discover\/?(?:\?|$)/.test(req.url)) req.url = req.url.replace(/^\/discover\/?/, "/discover.html");
        if (req.url && /^\/about\/?(?:\?|$)/.test(req.url)) req.url = req.url.replace(/^\/about\/?/, "/about.html");
        next();
      });
    },
    closeBundle() {
      // The nested static address must use the same built scripts/styles as the Vite entry.
      try {
        const entry = path.resolve(__dirname, "dist/discover.html");
        if (!existsSync(entry)) return;
        const html = readFileSync(entry, "utf8");
        const outDir = path.resolve(__dirname, "dist/discover");
        mkdirSync(outDir, { recursive: true });
        writeFileSync(path.join(outDir, "index.html"), html);
      } catch (err) {
        console.warn("[mirror-discover-entry] skipped:", err);
      }
    },
  }].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    target: "es2022",
    rollupOptions: {
      // Plain scripts served from public/ are loaded at runtime, not bundled.
      external: ["/creator-profile-links.js", "/coin-badges.js"],
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
