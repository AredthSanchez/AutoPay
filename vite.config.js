/**
 * Tells Vite, the tool that runs and builds the app, how to work with React screens and the
 * Cloudflare server. It also sets how local development runs.
 */
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { cloudflare } from "@cloudflare/vite-plugin";
export default defineConfig({
  plugins: [react(), cloudflare({ inspectorPort: false })],
  server: { host: "127.0.0.1", watch: { usePolling: true } },
});
