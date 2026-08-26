import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// A separate client-only build for Firebase Hosting. It intentionally has no
// server entry, API routes, Firebase functions, or CrazyGames sitelock.
export default defineConfig({
  root: "firebase",
  base: "./",
  publicDir: false,
  plugins: [react()],
  build: {
    outDir: "../firebase-dist",
    assetsDir: "assets",
    emptyOutDir: true,
    target: "es2020",
  },
});
