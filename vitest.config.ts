import { defineConfig } from "vitest/config";

// Keep unit tests independent of the Cloudflare/Vinext preview pipeline.
// The editor core is deliberately browser-framework agnostic.
export default defineConfig({
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts"],
  },
});

