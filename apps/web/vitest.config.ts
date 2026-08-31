import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    // Node environment: everything under test here is pure logic — pricing,
    // coupon rules, serviceability, line identity. Component tests would want
    // jsdom, but pulling it in for these would slow the fast feedback loop
    // that makes them worth running on every save.
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
