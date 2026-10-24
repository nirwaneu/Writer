import { describe, expect, it } from "vitest";
import {
  chapterDisplayNumber,
  chapterDisplayTitle,
  illustrationUrl,
  pageKindLabel,
} from "@/lib/pages";
import type { Chapter } from "@/lib/schemas";

const chapter: Chapter = {
  number: 3,
  chapterNumber: 2,
  title: "Chapter 2",
  summary: "",
  status: "planned",
  wordCount: 0,
  summaryStale: false,
  updatedAt: "2026-01-01T00:00:00.000Z",
  kind: "chapter",
};

const illustration: Chapter = {
  number: 2,
  title: "Illustration",
  summary: "",
  status: "planned",
  wordCount: 0,
  summaryStale: false,
  updatedAt: "2026-01-01T00:00:00.000Z",
  kind: "illustration",
  image: {
    path: "illustration-2-abc.png",
    prompt: "A map room",
    negativePrompt: "",
    aspectRatio: "portrait",
    providerId: "provider-a",
    model: "flux",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
};

describe("page helpers", () => {
  it("uses the logical chapter number when illustrations are interleaved", () => {
    expect(chapterDisplayNumber(chapter)).toBe(2);
    expect(pageKindLabel(chapter)).toBe("Chapter 2");
    expect(pageKindLabel(illustration)).toBe("Illustration");
  });

  it("keeps the number as a subtitle when no custom title exists", () => {
    expect(chapterDisplayTitle(chapter)).toBe("Untitled Chapter");
    expect(chapterDisplayTitle({ ...chapter, title: "The Warm Ink" })).toBe(
      "The Warm Ink",
    );
    expect(chapterDisplayTitle(illustration)).toBe("Illustration");
  });

  it("builds a stable local illustration URL", () => {
    expect(illustrationUrl("my-book", illustration.image!.path)).toBe(
      "/api/novels/my-book/illustrations/illustration-2-abc.png",
    );
  });
});
