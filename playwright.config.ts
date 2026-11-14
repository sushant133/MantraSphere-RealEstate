import { defineConfig, devices } from "@playwright/test";

/**
 * E2E against a running server (dev or production build).
 *   E2E_BASE_URL=http://localhost:3000 npx playwright test
 * Uses the system Chrome (channel "chrome"); CI can install Playwright's own browsers.
 */
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  fullyParallel: false,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    channel: process.env.CI ? undefined : "chrome",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], channel: process.env.CI ? undefined : "chrome" } },
    // Admin and owner flows are desktop-only; mobile covers the public site.
    { name: "mobile", testIgnore: /(admin|owner|payments).spec.ts/, use: { ...devices["Pixel 7"], channel: process.env.CI ? undefined : "chrome" } },
  ],
});
