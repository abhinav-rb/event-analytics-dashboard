import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// The dashboard calls the API at /api/*, proxied to the Express server in dev.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:4000",
    },
  },
});
