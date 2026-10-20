import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  outputDir: "./test-results/e2e-artifacts",
  reporter: [["list"], ["html", { outputFolder: "test-results/e2e-report", open: "never" }]],
  fullyParallel: false,
  retries: 0,
  use: {
    baseURL: "http://127.0.0.1:4178",
    browserName: "chromium",
    colorScheme: "dark",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run dev -- --host 127.0.0.1 --port 4178",
    url: "http://127.0.0.1:4178/fitland/login",
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
