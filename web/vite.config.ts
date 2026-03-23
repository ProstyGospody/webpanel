import { fileURLToPath, URL } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiProxyTarget = (env.PANEL_API_INTERNAL_URL || env.VITE_API_PROXY_TARGET || "").trim().replace(/\/$/, "");

  return {
    plugins: [react()],
    resolve: {
      alias: {
        "@": fileURLToPath(new URL(".", import.meta.url)),
      },
    },
    server: {
      host: "0.0.0.0",
      port: 5173,
      strictPort: true,
      proxy: apiProxyTarget
        ? {
            "/api": {
              target: apiProxyTarget,
              changeOrigin: true,
            },
            "/hysteria": {
              target: apiProxyTarget,
              changeOrigin: true,
            },
          }
        : undefined,
    },
    preview: {
      host: "127.0.0.1",
      port: 13000,
      strictPort: true,
    },
    build: {
      outDir: "dist",
      sourcemap: false,
    },
  };
});