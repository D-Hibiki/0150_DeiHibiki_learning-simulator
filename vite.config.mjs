import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => ({
  build: {
    outDir: "dist/client",
  },
  optimizeDeps: {
    include: ["react", "react-dom/client"],
  },
  server: {
    host: mode === "agent" ? "127.0.0.1" : "0.0.0.0",
    strictPort: mode === "agent",
    allowedHosts: ["terminal.local"],
    proxy: mode === "agent" ? {
      "/api/agent-world": {
        target: "http://127.0.0.1:8787",
        changeOrigin: false,
      },
    } : undefined,
    warmup: {
      clientFiles: ["./src/main.tsx"],
    },
  },
  plugins: [react()],
}));
