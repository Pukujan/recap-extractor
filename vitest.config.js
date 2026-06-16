import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["backend/src/modules/recap-import/__tests__/**/*.test.js"],
    setupFiles: [],
  },
});
