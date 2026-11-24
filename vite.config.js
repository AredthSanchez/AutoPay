/**
 * Configures the tools that run AutoPay locally and build the files for hosting. Connects React,
 * which displays the screens, with the Cloudflare server used for requests.
 * Sets the local server address and file watching options.
 */
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { cloudflare } from "@cloudflare/vite-plugin";
export default defineConfig({
  plugins: [react(), cloudflare({ inspectorPort: false })],
  server: { host: "127.0.0.1", watch: { usePolling: true } },
});
