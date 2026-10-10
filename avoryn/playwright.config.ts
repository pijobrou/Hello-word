import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.PORT ?? 3200);
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./tests",
  timeout: 60_000,
  fullyParallel: true,
  workers: process.env.CI ? 2 : 3,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    // Chromium préinstallé (environnement sans téléchargement de navigateur).
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH }
      : undefined,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // Les tests s'exécutent contre le build de production (npm run build au préalable).
    command: `npx next start -p ${PORT}`,
    url: `${baseURL}/fr`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      CONTACT_DELIVERY: "log",
      CONTACT_RATE_LIMIT: "100",
    },
  },
});
