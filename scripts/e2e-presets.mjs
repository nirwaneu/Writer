import { chromium } from "playwright";
import assert from "node:assert/strict";
import path from "node:path";
import Database from "better-sqlite3";

const BASE = "http://localhost:3000";
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
page.on("pageerror", (error) => console.log("PAGEERROR:", error.message));
page.on("console", (message) => { if (message.type() === "error") console.log("CONSOLE:", message.text()); });

try {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.locator("#username").fill("writer");
  await page.locator("#password").fill("writer");
  await page.getByRole("button", { name: "Enter the desk" }).click();
  await page.waitForURL(`${BASE}/`);

  console.log("1. preset manager");
  await page.goto(`${BASE}/presets`, { waitUntil: "networkidle" });
  await page.getByText("Default / General Fiction").first().waitFor();
  await page.getByRole("button", { name: "New preset" }).click();
  await page.getByText("Preset created.").waitFor({ timeout: 15000 });
  const nameInput = page.locator("#preset-name");
  await nameInput.fill("UI Preset");
  await page.getByRole("tab", { name: "Executor" }).click();
  const tempInput = page.getByLabel("Temperature value");
  await tempInput.fill("1.25");
  await tempInput.blur();
  await page.getByRole("button", { name: "Save preset" }).click();
  await page.getByText("Preset saved.").waitFor({ timeout: 15000 });
  await page.getByRole("button", { name: "Set as default" }).click();
  await page.getByText("is now the default for new books.").waitFor({ timeout: 15000 });
  await page.screenshot({ path: ".impeccable/review/presets-desktop.png", fullPage: true });
  console.log("   ok");

  console.log("2. new book dialog + copy-on-write");
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Create new" }).click();
  await page.getByRole("dialog").waitFor();
  await page.screenshot({ path: ".impeccable/review/new-book-dialog.png" });
  const presetsResponse = await context.request.get(`${BASE}/api/presets`);
  const presetsPayload = await presetsResponse.json();
  await page.locator("#new-book-preset").selectOption(presetsPayload.defaultPresetId);
  await page.getByRole("button", { name: "Start brainstorming" }).click();
  await page.waitForURL(/\/new\?draft=/, { timeout: 20000 });
  const draftId = new URL(page.url()).searchParams.get("draft");
  const db = new Database(path.resolve("data/vibedraft.db"), { readonly: true });
  const draftRow = db.prepare("select preset_id, executor_model, roles_json from books where id = ?").get(draftId);
  assert.equal(draftRow.preset_id, presetsPayload.defaultPresetId);
  assert.match(draftRow.executor_model, /^(?:.+\|)?mock-(?:executor|summarizer)$/);
  const draftRoles = JSON.parse(draftRow.roles_json);
  console.log("   draft config ok", draftRoles.executor.params.temperature);
  await page.getByRole("button", { name: "Discard this draft" }).click();
  await page.getByRole("button", { name: "Discard draft" }).click();
  await page.waitForURL(`${BASE}/`, { timeout: 20000 });

  console.log("3. book settings fallback + local save");
  await page.goto(`${BASE}/novels/the-cartographers-debt/write?chapter=2`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Book model settings" }).click();
  await page.getByText(/Global fallback|Local settings/).first().waitFor({ timeout: 15000 });
  await page.screenshot({ path: ".impeccable/review/book-settings-desktop.png" });
  await page.getByRole("tab", { name: "Executor" }).click();
  const globalExecutor = db
    .prepare("select executor_model from global_settings where id = 1")
    .get().executor_model;
  const currentExecutor = await page.locator("#model-executor").innerText();
  const nextExecutor = currentExecutor.includes("mock-summarizer")
    ? "mock-executor"
    : "mock-summarizer";
  await page.locator("#model-executor").click();
  await page.getByRole("option", { name: new RegExp(nextExecutor) }).first().click();
  await page.getByRole("button", { name: "Save for this book" }).click();
  await page.getByText("Book settings saved. New generations use them.").waitFor({ timeout: 15000 });
  const bookRow = db.prepare("select executor_model from books where slug = ?").get("the-cartographers-debt");
  assert.match(bookRow.executor_model, new RegExp(`^.+\\|${nextExecutor}$`));
  const globalRow = db.prepare("select executor_model from global_settings where id = 1").get();
  assert.equal(globalRow.executor_model, globalExecutor);
  db.close();
  console.log("   local save ok, global untouched");

  await page.getByRole("button", { name: "Book model settings" }).click();
  await page.getByText("Local settings").waitFor({ timeout: 15000 });
  await page.screenshot({ path: ".impeccable/review/book-settings-local.png" });
  await page.getByRole("button", { name: "Cancel" }).click();

  console.log("4. direct /new preset picker");
  await page.goto(`${BASE}/new`, { waitUntil: "networkidle" });
  await page.locator("#start-preset").selectOption(presetsPayload.defaultPresetId);
  await page.screenshot({ path: ".impeccable/review/new-start-preset.png", fullPage: true });

  console.log("ALL PRESET UI CHECKS PASSED");
} finally {
  await browser.close();
}
