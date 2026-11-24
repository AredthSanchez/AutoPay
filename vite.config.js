/**
 * Vite build and local development configuration for React and the Cloudflare Worker integration.
 */
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { cloudflare } from "@cloudflare/vite-plugin";
export default defineConfig({
  plugins: [react(), cloudflare({ inspectorPort: false })],
  server: { host: "127.0.0.1", watch: { usePolling: true } },
});
