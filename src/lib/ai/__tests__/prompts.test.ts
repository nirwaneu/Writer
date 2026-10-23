import { describe, expect, it } from "vitest";
import {
  buildChapterSummaryMessages,
  buildExecutorMessages,
  buildPlannerMessages,
  splitForSummary,
} from "@/lib/ai/prompts";
import type { ChatMessage, Outline } from "@/lib/schemas";
import { createDefaultPreset } from "@/lib/presets/defaults";

const outline: Outline = {
  version: 1,
  id: "novel-1",
  title: "The Cartographer's Debt",
  premise: "A cartographer returns to a house that remembers her.",
  status: "active",
  characters: [{ name: "Mara", role: "protagonist", description: "A cartographer." }],
  chapters: [
    {
      number: 1,
      title: "The Gate",
      summary: "Mara arrives and finds a map with a warm coastline.",
      status: "summarized",
      wordCount: 1200,
      summaryStale: false,
      kind: "chapter",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
    {
      number: 2,
      title: "The Wall",
      summary: "",
      status: "planned",
      wordCount: 0,
      summaryStale: false,
      kind: "chapter",
      updatedAt: "2026-01-02T00:00:00.000Z",
    },
  ],
  currentChapter: 2,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-02T00:00:00.000Z",
};

const roles = createDefaultPreset().roles;

const plan: ChatMessage[] = [
  {
    id: "u1",
    role: "user",
    content: "Open with her counting the bricks.",
    createdAt: "2026-01-02T00:00:00.000Z",
  },
  {
    id: "a1",
    role: "assistant",
    content: "Beat 1: arrival. Beat 2: the wall. Beat 3: the map.",
    createdAt: "2026-01-02T00:01:00.000Z",
  },
];

describe("planner prompt", () => {
  it("keeps the system message clean and injects the vault into a user message", () => {
    const messages = buildPlannerMessages(
      outline,
      2,
      plan,
      "What next?",
      roles.planner.systemPrompt,
    );
    expect(messages[0]).toEqual({
      role: "system",
      content: roles.planner.systemPrompt.trim(),
    });
    const context = messages[1].content;
    expect(context).toContain("The Cartographer's Debt");
    expect(context).toContain("A cartographer returns");
    expect(context).toContain("Mara");
    expect(context).toContain("Mara arrives and finds a map");
    expect(context).toContain("[CURRENT CHAPTER]");
    expect(messages[0].content).not.toContain("The Cartographer's Debt");
  });

  it("carries the conversation and the new message", () => {
    const messages = buildPlannerMessages(
      outline,
      2,
      plan,
      "What next?",
      roles.planner.systemPrompt,
    );
    expect(messages.some((message) => message.content.includes("Beat 1"))).toBe(true);
    expect(messages.at(-1)?.content).toContain("What next?");
    expect(messages.at(-1)?.content).toContain("Plan this chapter");
  });
});

describe("executor prompt", () => {
  it("keeps the system message clean and puts vault + plan in the user message", () => {
    const messages = buildExecutorMessages(outline, 2, plan, roles.executor.systemPrompt);
    expect(messages[0]).toEqual({
      role: "system",
      content: roles.executor.systemPrompt.trim(),
    });
    const user = messages[1].content;
    expect(user).toContain("Mara arrives and finds a map");
    expect(user).toContain("Beat 1");
    expect(user).toContain("Write Chapter 2 now.");
    expect(messages[0].content).not.toContain("Mara arrives and finds a map");
  });

  it("refuses to execute without a plan", () => {
    expect(() => buildExecutorMessages(outline, 2, [], roles.executor.systemPrompt)).toThrow(
      "NO_PLAN",
    );
  });
});

describe("chapter summary prompt", () => {
  it("includes the chapter text in a user message", () => {
    const messages = buildChapterSummaryMessages(
      outline,
      1,
      "The gate knew her hand.",
      roles.summarizer.systemPrompt,
    );
    expect(messages[0]).toEqual({
      role: "system",
      content: roles.summarizer.systemPrompt.trim(),
    });
    expect(messages[1].content).toContain("The gate knew her hand.");
    expect(messages[1].content).toContain("Summarize the chapter");
    expect(messages[0].content).not.toContain("The gate knew her hand.");
  });
});

describe("splitForSummary", () => {
  it("splits on paragraph boundaries", () => {
    const paragraph = "x".repeat(300);
    const chunks = splitForSummary(Array(5).fill(paragraph).join("\n\n"), 700);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((chunk) => chunk.length <= 700)).toBe(true);
  });

  it("keeps short text intact", () => {
    expect(splitForSummary("one paragraph", 700)).toEqual(["one paragraph"]);
  });
});
