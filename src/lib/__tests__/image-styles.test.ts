import { describe, expect, it } from "vitest";
import {
  applyArtStyle,
  ART_STYLES,
  DEFAULT_ART_STYLE_ID,
  getArtStyle,
} from "@/lib/image-styles";

describe("art styles", () => {
  it("defaults to the raw prompt", () => {
    expect(DEFAULT_ART_STYLE_ID).toBe("none");
    expect(getArtStyle("missing").name).toBe("None (Raw Prompt)");
    expect(applyArtStyle("A map room", "none")).toBe("A map room");
  });

  it("appends the selected style suffix exactly", () => {
    const style = ART_STYLES.find((item) => item.id === "classic-watercolor")!;
    expect(applyArtStyle("A map room", style.id)).toBe(
      `A map room${style.promptSuffix}`,
    );
  });

  it("includes the required presets", () => {
    expect(ART_STYLES.map((style) => style.name)).toEqual([
      "None (Raw Prompt)",
      "Classic Watercolor",
      "Vintage Pulp Fiction",
      "Visual Novel / Anime",
      "Oil Painting",
      "Dark Gothic Engraving",
      "Abstract Cover Art",
    ]);
  });
});
