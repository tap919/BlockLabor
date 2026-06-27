import { defineConfig } from "@playwright/test";

/**
 * Integration test config - assumes services are already running.
 * Does NOT start any webServers.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: /.*integration.*\.spec\.ts$/,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://localhost:3000",
    actionTimeout: 10000,
    navigationTimeout: 10000,
  },
});