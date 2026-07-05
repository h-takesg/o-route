import { defineConfig, devices } from "@playwright/test";
import http from "node:http";

const E2E_PORT = 3000;
const BASE_URL = `http://127.0.0.1:${E2E_PORT}`;

function probeServer(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    const request = http.get(url, (response) => {
      response.resume();
      resolve(response.statusCode !== undefined && response.statusCode < 500);
    });
    request.on("error", () => resolve(false));
    request.setTimeout(2_000, () => {
      request.destroy();
      resolve(false);
    });
  });
}

const devServerRunning = await probeServer(`${BASE_URL}/`);

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: "playwright-report" }],
    ["json", { outputFile: "playwright-report/results.json" }],
  ],
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: devServerRunning
    ? undefined
    : {
        command: "npm run e2e:server",
        url: BASE_URL,
        timeout: 180_000,
        // Default is a forceful SIGKILL, which skips firebase-tools' emulator
        // cleanup (finally-block `cleanShutdown()`) and leaves the Java-based
        // Database/Storage Emulator processes running as orphans, blocking
        // the port on the next run. SIGTERM lets firebase-tools shut down
        // the emulators cleanly before Playwright escalates to SIGKILL.
        gracefulShutdown: { signal: "SIGTERM", timeout: 10_000 },
      },
});
