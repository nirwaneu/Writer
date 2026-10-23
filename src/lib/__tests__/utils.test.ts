import { describe, expect, it } from "vitest";
import { chapterStatusMeta, isChapterReadyToContinue } from "@/lib/chapter-status";
import { createId, readingTime, slugify, wordCount } from "@/lib/utils";
import type { Chapter } from "@/lib/schemas";

describe("slugify", () => {
  it("normalizes titles into folder names", () => {
    expect(slugify("The Cartographer's Debt")).toBe("the-cartographer-s-debt");
    expect(slugify("Café / Nocturne")).toBe("cafe-nocturne");
    expect(slugify("---")).toBe("");
  });
});

describe("createId", () => {
  it("falls back to getRandomValues when randomUUID is unavailable", () => {
    const source = {
      getRandomValues: (bytes: Uint8Array) => {
        bytes.fill(7);
        return bytes;
      },
    } as unknown as Crypto;

    const id = createId(source);
    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it("returns a v4 UUID in secure contexts", () => {
    expect(createId()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });
});

describe("wordCount", () => {
  it("counts whitespace-separated words", () => {
    expect(wordCount("")).toBe(0);
    expect(wordCount("  one\ntwo\tthree  ")).toBe(3);
  });
});

describe("readingTime", () => {
  it("never reports zero minutes", () => {
    expect(readingTime(0)).toBe("1 min read");
    expect(readingTime(460)).toBe("2 min read");
  });
});

describe("chapterStatusMeta", () => {
  it("marks a stale summary as a problem", () => {
    expect(chapterStatusMeta("summarized", true)).toEqual({
      label: "Summary stale",
      tone: "danger",
    });
  });

  it("labels a skipped summary", () => {
    expect(chapterStatusMeta("summary_skipped").label).toBe("Summary skipped");
  });
});

describe("isChapterReadyToContinue", () => {
  const base: Chapter = {
    number: 1,
    title: "One",
    summary: "Something happened.",
    status: "summarized",
    wordCount: 100,
    summaryStale: false,
    updatedAt: "2026-01-01T00:00:00.000Z",
  };

  it("requires a fresh or explicitly skipped summary", () => {
    expect(isChapterReadyToContinue(base)).toBe(true);
    expect(isChapterReadyToContinue({ ...base, summaryStale: true })).toBe(false);
    expect(isChapterReadyToContinue({ ...base, status: "drafted" })).toBe(false);
    expect(isChapterReadyToContinue({ ...base, status: "summary_skipped" })).toBe(true);
  });
});
