import { defineConfig, mergeConfig } from "vitest/config";
import viteConfig from "./vite.config.mjs";

export default mergeConfig(
  viteConfig({ mode: "test", command: "serve", isSsrBuild: false, isPreview: false }),
  defineConfig({
    test: {
      environment: "jsdom",
      include: ["src/**/*.test.{ts,tsx}", "local/**/*.test.ts"],
      setupFiles: ["./src/test/setup.ts"],
      css: true,
      restoreMocks: true,
      clearMocks: true,
    },
  }),
);
