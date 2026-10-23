import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const OUT = path.resolve(".impeccable/review");

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
  });
  await context.addInitScript(() => {
    window.localStorage.setItem("theme", "night");
  });
  const page = await context.newPage();
  page.on("console", (message) => {
    if (message.type() === "error") console.log("console error:", message.text());
  });

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.screenshot({ path: path.join(OUT, "login-desktop.png"), fullPage: true });

  await page.locator("#username").fill("writer");
  await page.locator("#password").fill("writer");
  await page.getByRole("button", { name: "Enter the desk" }).click();
  await page.waitForURL(`${BASE}/`);
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: path.join(OUT, "library-desktop.png"), fullPage: true });

  await page.goto(`${BASE}/novels/the-cartographers-debt`, { waitUntil: "networkidle" });
  await page.screenshot({ path: path.join(OUT, "book-desktop.png"), fullPage: true });

  await page.goto(`${BASE}/novels/the-cartographers-debt/read?chapter=2`, {
    waitUntil: "networkidle",
  });
  await page.screenshot({ path: path.join(OUT, "read-desktop.png") });

  await page.goto(`${BASE}/novels/the-cartographers-debt/write?chapter=2`, {
    waitUntil: "networkidle",
  });
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(OUT, "workspace-desktop.png") });

  await page.goto(`${BASE}/settings`, { waitUntil: "networkidle" });
  await page.screenshot({ path: path.join(OUT, "settings-desktop.png"), fullPage: true });

  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(OUT, "library-mobile.png"), fullPage: true });

  await page.goto(`${BASE}/novels/the-cartographers-debt/write?chapter=2`, {
    waitUntil: "networkidle",
  });
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(OUT, "workspace-mobile.png") });

  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.screenshot({ path: path.join(OUT, "login-mobile.png"), fullPage: true });

  await page.setViewportSize({ width: 1440, height: 900 });

  await page.goto(`${BASE}/new`, { waitUntil: "networkidle" });
  await page.screenshot({ path: path.join(OUT, "new-start-desktop.png"), fullPage: true });

  await browser.close();
  console.log(`Screenshots written to ${OUT}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
