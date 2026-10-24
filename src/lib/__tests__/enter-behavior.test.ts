import { describe, expect, it } from "vitest";
import { enterHint, submitsOnEnter } from "@/lib/use-enter-behavior";

const key = (overrides: Partial<{ key: string; shiftKey: boolean; ctrlKey: boolean; metaKey: boolean }> = {}) => ({
  key: "Enter",
  shiftKey: false,
  ctrlKey: false,
  metaKey: false,
  ...overrides,
});

describe("enter behavior", () => {
  it("sends on Enter when Enter-to-send is selected", () => {
    expect(submitsOnEnter("send", key())).toBe(true);
    expect(submitsOnEnter("send", key({ shiftKey: true }))).toBe(false);
    expect(submitsOnEnter("send", key({ ctrlKey: true }))).toBe(false);
  });

  it("sends on Ctrl/Cmd+Enter when Enter adds a new line", () => {
    expect(submitsOnEnter("newline", key())).toBe(false);
    expect(submitsOnEnter("newline", key({ shiftKey: true }))).toBe(false);
    expect(submitsOnEnter("newline", key({ ctrlKey: true }))).toBe(true);
    expect(submitsOnEnter("newline", key({ metaKey: true }))).toBe(true);
  });

  it("ignores other keys", () => {
    expect(submitsOnEnter("send", key({ key: "a" }))).toBe(false);
  });

  it("describes the active mode", () => {
    expect(enterHint("send")).toContain("Enter to send");
    expect(enterHint("newline")).toContain("Ctrl");
  });
});
