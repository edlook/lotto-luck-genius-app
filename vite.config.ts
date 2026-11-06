import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")) as { version: string };
const BG = "#151c28"; // hsl(220 30% 12%) = --background
// Sub-path deployments (GitHub Pages: /<repo>/) set VITE_BASE; local dev and root hosting use "/".
const rawBase = process.env.VITE_BASE ?? "/";
const BASE = rawBase.endsWith("/") ? rawBase : `${rawBase}/`;

export default defineConfig({
  base: BASE,
  define: {
    __APP_VERSION__: JSON.stringify(`${pkg.version} (${new Date().toISOString().slice(0, 10)})`),
  },
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  server: { port: 8080 },
  preview: { port: 4173 },
  build: {
    target: "es2022",
    // The draw archives are fetched at runtime, never inlined.
    assetsInlineLimit: 4096,
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: "script-defer",
      workbox: {
        // App shell, all screen chunks, fonts and icons are precached; draw data is cached at runtime.
        globPatterns: ["**/*.{js,css,html,woff2,svg,png,ico}"],
        globIgnores: ["data/**"],
        navigateFallback: `${BASE}index.html`,
        navigateFallbackDenylist: [/\/data\//],
        cleanupOutdatedCaches: true,
        // The registration script is injected as "script-defer", so the plugin does not add these
        // itself (QA B1): without them a new worker stays in "waiting" until every tab is closed.
        // The page announces the switch (see useServiceWorkerUpdate) and reloads on request.
        skipWaiting: true,
        clientsClaim: true,
        runtimeCaching: [
          {
            // Draw archives: the network first (QA B5: a stale copy would hide the newest draw for a
            // whole session), the cached copy when offline or when the network takes over 3 s.
            urlPattern: ({ url }) => url.pathname.startsWith(`${BASE}data/`) && url.pathname.endsWith(".json"),
            handler: "NetworkFirst",
            options: {
              cacheName: "llg-draw-data",
              networkTimeoutSeconds: 3,
              expiration: { maxEntries: 8 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      manifest: {
        id: BASE,
        name: "Lotto-Luck-Genius",
        short_name: "LLG",
        description:
          "Личный инструмент для EuroJackpot и Lotto 6 aus 49: генератор, проверка билетов, вероятности и статистика.",
        lang: "ru",
        dir: "ltr",
        theme_color: BG,
        background_color: BG,
        display: "standalone",
        orientation: "portrait",
        scope: BASE,
        start_url: BASE,
        categories: ["utilities", "productivity"],
        icons: [
          { src: "pwa-192x192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "pwa-512x512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          // Full-bleed background, motif inside the 40 % safe zone (scripts/build-maskable-icon.mjs).
          { src: "pwa-maskable-512x512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
    }),
  ],
});
