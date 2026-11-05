import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")) as { version: string };
const BG = "#151c28"; // hsl(220 30% 12%) = --background

export default defineConfig({
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
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/data\//],
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            // Draw archives: show the cached copy at once, refresh in the background.
            urlPattern: ({ url }) => url.pathname.startsWith("/data/") && url.pathname.endsWith(".json"),
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "llg-draw-data",
              expiration: { maxEntries: 8 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      manifest: {
        id: "/",
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
        scope: "/",
        start_url: "/",
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
