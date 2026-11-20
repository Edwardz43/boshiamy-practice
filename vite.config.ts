import { writeFileSync } from "node:fs";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  base: "./",
  build: { assetsDir: "" },
  plugins: [
    react(),
    {
      name: "nojekyll",
      closeBundle() {
        writeFileSync("dist/.nojekyll", "");
      },
    },
    VitePWA({
      registerType: "autoUpdate",
      filename: "sw.js",
      includeAssets: [
        "icon-192.png",
        "icon-512.png",
        "icon-512-maskable.png",
        "apple-touch-icon.png",
        "manifest.webmanifest",
      ],
      manifest: false,
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,webmanifest,woff,woff2,json}"],
        navigateFallback: "index.html",
      },
    }),
  ],
});
