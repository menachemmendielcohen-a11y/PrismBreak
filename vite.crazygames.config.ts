import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// A separate, entirely static build for HTML5 game portals such as CrazyGames.
// Keeping it separate lets the hosted game retain its D1-backed leaderboard.
export default defineConfig({
  root: "crazygames",
  // Portal hosts may mount an uploaded game below their own URL path or inside
  // an iframe, so asset URLs must remain relative to index.html.
  base: "./",
  plugins: [react()],
  build: {
    outDir: "../crazygames-dist",
    emptyOutDir: true,
    target: "es2020",
  },
});
