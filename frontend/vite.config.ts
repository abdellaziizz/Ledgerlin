import { fileURLToPath, URL } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  // The backend sends no CORS headers, so the browser talks to the Vite origin
  // and Vite forwards /api to Express.
  const target = env.VITE_API_PROXY_TARGET || "http://127.0.0.1:3000";

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
    },
    server: {
      proxy: {
        "/api": { target, changeOrigin: true },
        "/health": { target, changeOrigin: true },
      },
    },
    preview: {
      proxy: {
        "/api": { target, changeOrigin: true },
      },
    },
  };
});
