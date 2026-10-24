import { chromium } from "playwright";
import assert from "node:assert/strict";

const BASE = "http://localhost:3000";

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
page.on("pageerror", (error) => console.log("PAGEERROR:", error.message));

try {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.locator("#username").fill("writer");
  await page.locator("#password").fill("writer");
  await page.getByRole("button", { name: "Enter the desk" }).click();
  await page.waitForURL(`${BASE}/`);

  console.log("1. provider test + default models");
  await page.goto(`${BASE}/settings`, { waitUntil: "networkidle" });
  await page.getByRole("tab", { name: /Providers/ }).click();
  await page.getByRole("button", { name: "Test", exact: true }).first().click();
  await page.getByText(/Connected|connected/i).first().waitFor({ timeout: 20000 });
  await page.getByRole("tab", { name: "Models" }).click();
  await page.getByText("Default models").waitFor({ timeout: 20000 });
  const currentExecutor = await page.locator("#default-model-executor").innerText();
  const nextExecutor = currentExecutor.includes("mock-executor")
    ? "mock-summarizer"
    : "mock-executor";
  await page.locator("#default-model-executor").click();
  await page.getByRole("option", { name: new RegExp(nextExecutor) }).first().click();
  const save = page.getByRole("button", { name: "Save models" });
  await save.waitFor();
  assert.equal(await save.isDisabled(), false, "Save models should unlock after a change");
  await save.click();
  await page.getByText("Default models saved.").waitFor({ timeout: 10000 });
  console.log("   ok");

  console.log("2. create new -> premise -> chapter 1");
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Create new" }).click();
  await page.getByRole("dialog").waitFor();
  await page.getByRole("button", { name: "Start brainstorming" }).click();
  await page.waitForURL(/\/new\?draft=/, { timeout: 20000 });
  await page.getByPlaceholder("What is this book about?").fill(
    "A translator in a flooded city discovers that every language remembers the same disaster differently.",
  );
  await page.getByPlaceholder("What is this book about?").press("Enter");
  await page.getByText("The Planner is thinking.").waitFor({ timeout: 20000 });
  await page.getByText("Here is a shape for the chapter.").waitFor({ timeout: 30000 });
  await page.getByRole("button", { name: "Premise done" }).click();
  await page.waitForURL(/\/novels\/[^/]+\/write\?chapter=1/, { timeout: 40000 });
  const newSlug = new URL(page.url()).pathname.split("/")[2];
  console.log("   published", newSlug);
  await page.screenshot({ path: ".impeccable/review/workspace-new.png" });
  await context.request.delete(`${BASE}/api/novels/${newSlug}`);
  console.log("   cleaned up");

  console.log("3. rewrite chapter 2 -> summary -> continue");
  await page.goto(`${BASE}/novels/the-cartographers-debt/write?chapter=2`, {
    waitUntil: "networkidle",
  });
  await page.getByRole("button", { name: "Rewrite this chapter" }).click();
  await page.getByRole("button", { name: "Execute and replace" }).click();
  await page.getByText("The Executor is writing this chapter.").waitFor({ timeout: 20000 });
  await page.getByText("Chapter 2 drafted.").waitFor({ timeout: 60000 });
  await page.getByRole("button", { name: "Generate summary" }).first().click();
  await page.getByText("Chapter summary and title saved.").waitFor({ timeout: 60000 });
  await page.getByRole("button", { name: /Continue to chapter/ }).click();
  await page.waitForURL(/chapter=3/, { timeout: 20000 });
  console.log("   advanced to chapter 3");
  await page.screenshot({ path: ".impeccable/review/workspace-chapter3.png" });

  console.log("4. reading mode navigation");
  await page.goto(`${BASE}/novels/the-cartographers-debt/read?chapter=1`, {
    waitUntil: "networkidle",
  });
  await page.getByRole("button", { name: "View outline" }).click();
  await page.getByText("Story Vault").waitFor();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Ch. 2" }).click();
  await page.waitForURL(/chapter=2/);
  console.log("   ok");

  console.log("ALL UI CHECKS PASSED");
} finally {
  await browser.close();
}
