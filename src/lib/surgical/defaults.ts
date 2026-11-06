export type DefaultSurgicalPreset = {
  id: string;
  label: string;
  icon: string;
  instruction: string;
  sortOrder: number;
};

export const DEFAULT_SURGICAL_PRESETS: DefaultSurgicalPreset[] = [
  {
    id: "surgical-show-dont-tell",
    label: "Show, Don't Tell",
    icon: "👁️",
    instruction:
      "Transform abstract emotional statements into concrete physical actions, micro-expressions, and physiological cues. Preserve the original meaning, point of view, and approximate length.",
    sortOrder: 0,
  },
  {
    id: "surgical-tighten",
    label: "Tighten",
    icon: "✂️",
    instruction:
      "Strip filler words, redundancies, and passive voice while keeping the core meaning punchy and direct. Preserve the author's voice and all story information.",
    sortOrder: 1,
  },
  {
    id: "surgical-sensory",
    label: "Sensory Details",
    icon: "🌿",
    instruction:
      "Infuse atmospheric and sensory layers such as lighting, temperature, scent, texture, and subtle background sounds matching the scene's emotional tone. Do not add new plot events.",
    sortOrder: 2,
  },
  {
    id: "surgical-natural-dialog",
    label: "Natural Dialog",
    icon: "💬",
    instruction:
      "Calibrate stiff dialogue into an organic, conversational cadence with natural contractions, interruptions, and subtext. Preserve each character's intent and the scene's information.",
    sortOrder: 3,
  },
];