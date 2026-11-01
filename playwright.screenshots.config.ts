import { defineConfig, devices } from "@playwright/test";

const SCREENSHOT_PORT = 3100;
const BASE_URL = `http://127.0.0.1:${SCREENSHOT_PORT}`;

export default defineConfig({
  testDir: "./scripts/screenshots",
  testMatch: "**/*.capture.ts",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  timeout: 1_200_000,
  expect: { timeout: 30_000 },
  reporter: [["list"]],
  use: {
    baseURL: BASE_URL,
    trace: "off",
    screenshot: "off",
    video: "off",
    deviceScaleFactor: 1,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command:
      "npx firebase emulators:exec --only database,storage 'VITE_USE_FIREBASE_EMULATOR=true vite --host --port 3100'",
    url: BASE_URL,
    timeout: 240_000,
    reuseExistingServer: false,
    gracefulShutdown: { signal: "SIGTERM", timeout: 10_000 },
  },
});
