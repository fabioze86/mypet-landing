import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

const appRoot = fileURLToPath(new URL(".", import.meta.url)).replace(/[\\/]$/, "");

export default defineConfig({
  resolve: {
    alias: { "@": appRoot },
  },
});
