import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

/**
 * Vite configuration (BLD-023). The dev server binds 0.0.0.0 so the frontend
 * service is reachable from outside its container in `docker compose up`.
 * `VITE_API_BASE_URL` is read at build time via import.meta.env.
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    host: "0.0.0.0",
    port: 5173,
  },
  preview: {
    host: "0.0.0.0",
    port: 4173,
  },
});
