import { describe, expect, it } from "vitest";
import { buildDocx } from "@/lib/export/docx";
import type { Outline } from "@/lib/schemas";

const outline: Outline = {
  version: 1,
  id: "novel-1",
  title: "A Test Novel",
  premise: "A short premise.",
  status: "active",
  archived: false,
  characters: [],
  chapters: [
    {
      number: 1,
      title: "One",
      summary: "",
      status: "drafted",
      wordCount: 10,
      summaryStale: false,
      kind: "chapter",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
  ],
  currentChapter: 1,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("buildDocx", () => {
  it("produces a zip container with the chapter text", async () => {
    const buffer = await buildDocx(outline, [
      {
        number: 1,
        title: "One",
        markdown: "A **bold** opening.\n\n> A quote.\n\n- one\n- two\n",
      },
    ]);
    expect(buffer.length).toBeGreaterThan(1_000);
    expect(buffer.subarray(0, 2).toString()).toBe("PK");
  });
});

