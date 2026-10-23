export const DEFAULT_PRESET_ID = "default-general-fiction";

export const AI_ROLES = ["planner", "executor", "summarizer"] as const;
export type AIRole = (typeof AI_ROLES)[number];

export const ROLE_LABELS: Record<AIRole, string> = {
  planner: "Planner",
  executor: "Executor",
  summarizer: "Summarizer",
};
