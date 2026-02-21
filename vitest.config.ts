import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@/generated/prisma/client": path.resolve(
        __dirname,
        "./src/__tests__/__mocks__/prisma-client.ts"
      ),
    },
  },
  test: {
    globals: true,
    environment: "node",
    setupFiles: ["./src/__tests__/setup.ts"],
  },
});
