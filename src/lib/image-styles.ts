export type ArtStyle = {
  id: string;
  name: string;
  promptSuffix: string;
};

export const ART_STYLES: ArtStyle[] = [
  {
    id: "none",
    name: "None (Raw Prompt)",
    promptSuffix: "",
  },
  {
    id: "classic-watercolor",
    name: "Classic Watercolor",
    promptSuffix:
      ", classic book illustration, detailed pen and ink line art with soft watercolor wash, vintage storybook aesthetic, whimsical, masterpiece",
  },
  {
    id: "vintage-pulp",
    name: "Vintage Pulp Fiction",
    promptSuffix:
      ", vintage pulp fiction cover art, 1960s retro comic style, bold dramatic colors, heavy shadows, halftone print texture",
  },
  {
    id: "visual-novel-anime",
    name: "Visual Novel / Anime",
    promptSuffix:
      ", high quality anime illustration, visual novel CG, beautiful detailed background, cel shaded, vibrant colors, masterpiece",
  },
  {
    id: "oil-painting",
    name: "Oil Painting",
    promptSuffix:
      ", classical oil painting, rich visible brushstrokes, chiaroscuro lighting, museum gallery masterpiece, highly detailed",
  },
  {
    id: "dark-gothic-engraving",
    name: "Dark Gothic Engraving",
    promptSuffix:
      ", vintage woodcut engraving, Gustave Doré style, dark gothic aesthetic, high contrast black and white, intricate detailed linework",
  },
  {
    id: "abstract-cover-art",
    name: "Abstract Cover Art",
    promptSuffix:
      ", minimalist book cover design, abstract artistic composition, elegant layout, negative space for typography, modern editorial style",
  },
];

export const DEFAULT_ART_STYLE_ID = "none";

export function getArtStyle(id: string): ArtStyle {
  return (
    ART_STYLES.find((style) => style.id === id) ??
    ART_STYLES.find((style) => style.id === DEFAULT_ART_STYLE_ID)!
  );
}

export function applyArtStyle(basePrompt: string, styleId: string): string {
  const suffix = getArtStyle(styleId).promptSuffix;
  return suffix ? `${basePrompt}${suffix}` : basePrompt;
}
