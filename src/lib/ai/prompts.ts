import type { ChatMessage, Outline, RoleConfig } from "@/lib/schemas";
import type { ChatInputMessage } from "@/lib/ai/client";
import { chapterDisplayNumber, chapterDisplayTitle } from "@/lib/pages";

const MAX_PLAN_CHARS = 18_000;
const MAX_CHAT_CHARS = 26_000;

function fullText(text: string): string {
  return text.trim();
}

function characterBlock(outline: Outline): string {
  if (!outline.characters.length) return "No character sheet yet.";
  return outline.characters
    .map((character) => {
      const role = character.role ? ` (${character.role})` : "";
      const description = character.description ? ` — ${fullText(character.description)}` : "";
      return `- ${character.name}${role}${description}`;
    })
    .join("\n");
}

function chapterSummaries(outline: Outline, upToExclusive: number): string {
  const eligible = outline.chapters
    .filter((chapter) => chapter.number < upToExclusive && chapter.summary.trim())
    .sort((a, b) => a.number - b.number);

  if (!eligible.length) return "No previous chapters have been summarized yet.";
  return eligible
    .map(
      (chapter) =>
        `Chapter ${chapterDisplayNumber(chapter)} — ${chapterDisplayTitle(chapter)}${chapter.summaryStale ? " (summary may be stale)" : ""}\n${fullText(chapter.summary)}`,
    )
    .join("\n\n");
}

export function vaultContext(outline: Outline, upToExclusive: number): string {
  return [
    `Title: ${outline.title}`,
    `Premise:\n${fullText(outline.premise) || "No premise recorded."}`,
    `Characters:\n${characterBlock(outline)}`,
    `Chapter summaries:\n${chapterSummaries(outline, upToExclusive)}`,
  ].join("\n\n");
}

function transcript(messages: ChatMessage[], maxChars: number): string {
  const usable = messages.filter((message) => message.content.trim() && !message.failed);
  const kept: ChatMessage[] = [];
  let used = 0;
  for (let index = usable.length - 1; index >= 0; index -= 1) {
    const message = usable[index];
    const cost = message.content.length + 24;
    if (used + cost > maxChars && kept.length >= 2) break;
    kept.unshift(message);
    used += cost;
  }
  return kept
    .map((message) => `${message.role === "user" ? "AUTHOR" : "PLANNER"}: ${message.content.trim()}`)
    .join("\n\n");
}

function recentHistory(messages: ChatMessage[], maxChars: number): ChatMessage[] {
  const usable = messages.filter((message) => message.content.trim() && !message.failed);
  const kept: ChatMessage[] = [];
  let used = 0;
  for (let index = usable.length - 1; index >= 0; index -= 1) {
    const message = usable[index];
    const cost = message.content.length + 24;
    if (used + cost > maxChars && kept.length >= 2) break;
    kept.unshift(message);
    used += cost;
  }
  return kept;
}

function systemOnly(rolePrompt: string): ChatInputMessage {
  return { role: "system", content: rolePrompt.trim() };
}

function userMessage(content: string): ChatInputMessage {
  return { role: "user", content: content.trim() };
}

export type PromptInjections = {
  contextAnchor?: string;
  contextAnchorRole?: "system" | "user";
  assistantPrefill?: string;
};

export function roleInjections(
  role: Pick<
    RoleConfig,
    "injectionAfterSystemPrompt" | "injectionAfterLastMessage" | "contextAnchorRole"
  >,
): PromptInjections {
  return {
    contextAnchor: role.injectionAfterSystemPrompt,
    contextAnchorRole: role.contextAnchorRole,
    assistantPrefill: role.injectionAfterLastMessage,
  };
}

function applyInjections(
  messages: ChatInputMessage[],
  injections?: PromptInjections,
): ChatInputMessage[] {
  if (!injections) return messages;
  const anchor = injections.contextAnchor?.trim();
  const prefill = injections.assistantPrefill?.trim();
  if (!anchor && !prefill) return messages;

  const next = [...messages];
  if (anchor) {
    const lastUserIndex = next.findLastIndex((message) => message.role === "user");
    const insertAt = lastUserIndex >= 0 ? lastUserIndex : next.length;
    next.splice(insertAt, 0, {
      role: injections.contextAnchorRole === "user" ? "user" : "system",
      content: anchor,
    });
  }
  if (prefill) {
    next.push({ role: "assistant", content: prefill });
  }
  return next;
}

export function buildPlannerMessages(
  outline: Outline,
  chapter: number,
  history: ChatMessage[],
  userMessageText: string,
  rolePrompt: string,
  injections?: PromptInjections,
): ChatInputMessage[] {
  const chapterEntry = outline.chapters.find((item) => item.number === chapter);
  const displayNumber = chapterEntry ? chapterDisplayNumber(chapterEntry) : chapter;
  const context = [
    "[STORY CONTEXT]",
    vaultContext(outline, chapter),
    "",
    "[CURRENT CHAPTER]",
    `Chapter ${displayNumber}${chapterEntry ? ` — ${chapterDisplayTitle(chapterEntry)}` : ""}`,
    "This chapter has not been drafted yet." +
      (chapterEntry?.summary
        ? `\nAn earlier summary exists and may be stale:\n${fullText(chapterEntry.summary)}`
        : ""),
    "",
    "Use this context to plan. Do not repeat it back. The author's conversation follows.",
  ].join("\n");

  const messages: ChatInputMessage[] = [
    systemOnly(rolePrompt),
    userMessage(context),
    { role: "assistant", content: "Understood. I have the story context and will plan from it." },
  ];

  for (const message of recentHistory(history, MAX_CHAT_CHARS)) {
    messages.push({ role: message.role, content: message.content.trim() });
  }

  messages.push(userMessage(`${userMessageText.trim()}\n\n[TASK] Plan this chapter. Do not write manuscript prose, dialogue passages, or finished paragraphs.`));
  return applyInjections(messages, injections);
}

export function buildExecutorMessages(
  outline: Outline,
  chapter: number,
  history: ChatMessage[],
  rolePrompt: string,
  injections?: PromptInjections,
): ChatInputMessage[] {
  const chapterEntry = outline.chapters.find((item) => item.number === chapter);
  const displayNumber = chapterEntry ? chapterDisplayNumber(chapterEntry) : chapter;
  const plan = transcript(history, MAX_PLAN_CHARS);
  if (!plan.trim()) {
    throw new Error("NO_PLAN");
  }

  const content = [
    "[STORY CONTEXT]",
    vaultContext(outline, chapter),
    "",
    "[CHAPTER TO WRITE]",
    `Chapter ${displayNumber}${chapterEntry ? ` — ${chapterDisplayTitle(chapterEntry)}` : ""}`,
    "",
    "[THE AUTHOR'S PLAN]",
    plan,
    "",
    `[TASK] Write Chapter ${displayNumber} now. Output only the chapter prose in Markdown; do not include a chapter title heading, notes, or a summary.`,
  ].join("\n");

  return applyInjections([systemOnly(rolePrompt), userMessage(content)], injections);
}

export function buildPremiseMessages(
  history: ChatMessage[],
  rolePrompt: string,
  injections?: PromptInjections,
): ChatInputMessage[] {
  const chat = transcript(history, 30_000);
  if (!chat.trim()) throw new Error("NO_BRAINSTORM");

  return applyInjections([
    systemOnly(rolePrompt),
    userMessage([
      "[TASK]",
      "Convert the author's brainstorming conversation into the novel's premise for the Story Vault.",
      "Write 150–250 words in third person, present tense. State the protagonist, what they want, the obstacle, the stakes, the setting, the tone, and the central dramatic question.",
      "Preserve the author's decisions exactly. Do not invent names, plot facts, or genre claims that the conversation does not support. If something is undecided, leave it out rather than guessing.",
      "Output only the premise. No heading, no bullet points, no commentary.",
      "",
      "[BRAINSTORMING CONVERSATION]",
      chat,
      "",
      "Write the premise now.",
    ].join("\n")),
  ], injections);
}

export function buildTitleMessages(
  history: ChatMessage[],
  premise: string,
  rolePrompt: string,
): ChatInputMessage[] {
  const chat = transcript(history, 8_000);
  return [
    systemOnly(rolePrompt),
    userMessage([
      "[TASK]",
      "You name novels. Produce one title from the premise and notes.",
      "Two to seven words. Specific, evocative, and pronounceable. No subtitle, no quotation marks, no colon unless the title genuinely needs one. Do not explain.",
      "Output only the title.",
      "",
      "[PREMISE]",
      fullText(premise),
      "",
      "[NOTES]",
      chat,
      "",
      "Output one title.",
    ].join("\n")),
  ];
}

export function buildCharacterExtractionMessages(
  outline: Outline,
  rolePrompt: string,
  injections?: PromptInjections,
): ChatInputMessage[] {
  return applyInjections([
    systemOnly(rolePrompt),
    userMessage([
      "[TASK]",
      "Extract the characters implied by this novel's premise and record them for the Story Vault.",
      "Return only a JSON array. Each item must have exactly: name, role, description.",
      "Use 3-8 characters only. role is a short label such as protagonist, antagonist, ally, or minor. description is one or two factual sentences about want, obstacle, secret, or relationship. Do not invent characters the premise does not support; if only the protagonist is clear, return that one.",
      "",
      "[TITLE]",
      fullText(outline.title),
      "",
      "[PREMISE]",
      fullText(outline.premise) || "No premise recorded.",
      "",
      "Return the JSON array now.",
    ].join("\n")),
  ], injections);
}

export function buildImagePromptMessages(
  context: { kind: "chapter" | "cover"; title: string; premise: string; summary?: string; previousTitle?: string },
  rolePrompt: string,
  injections?: PromptInjections,
): ChatInputMessage[] {
  const subject =
    context.kind === "cover"
      ? [
          "[TASK]",
          "Write a book-cover illustration prompt from the title and premise.",
          "Make it iconic and atmospheric, suitable for a literary novel cover. Leave breathing room for typography; do not put text in the image.",
          "",
          "[TITLE]",
          fullText(context.title),
          "",
          "[PREMISE]",
          fullText(context.premise) || "No premise recorded.",
        ]
      : [
          "[TASK]",
          "Write an illustration prompt for the current chapter page, inspired by the previous chapter's summary.",
          "Capture a concrete visual moment, place, object, or character that belongs between these chapters. Do not illustrate abstract themes or add captions.",
          "",
          "[NOVEL]",
          fullText(context.title),
          "",
          "[PREVIOUS CHAPTER]",
          fullText(context.previousTitle || "Previous chapter"),
          "",
          "[PREVIOUS CHAPTER SUMMARY]",
          fullText(context.summary || "No previous chapter summary recorded."),
        ];

  return applyInjections([systemOnly(rolePrompt), userMessage(subject.join("\n"))], injections);
}

export function buildTitleGenerationMessages(
  context: string,
  rolePrompt: string,
  injections?: PromptInjections,
): ChatInputMessage[] {
  return applyInjections([
    systemOnly(rolePrompt),
    userMessage([
      "[TEXT]",
      fullText(context),
      "",
      "Output only the title.",
    ].join("\n")),
  ], injections);
}

export function buildChapterTitleMessages(
  outline: Outline,
  chapter: number,
  chapterText: string,
  rolePrompt: string,
): ChatInputMessage[] {
  const entry = outline.chapters.find((item) => item.number === chapter);
  const display = entry ? chapterDisplayNumber(entry) : chapter;
  return [
    systemOnly(rolePrompt),
    userMessage([
      "[TASK]",
      "Give this chapter a short, evocative title. Two to seven words. No chapter number, no subtitle, no quotation marks, no explanation.",
      "Base it on what actually happens in the chapter. Prefer a concrete image or a charged phrase over a generic label.",
      "Output only the title.",
      "",
      `[NOVEL] ${outline.title}`,
      `[CHAPTER ${display}]`,
      fullText(chapterText),
    ].join("\n")),
  ];
}

export function buildChapterSummaryMessages(
  outline: Outline,
  chapter: number,
  chapterText: string,
  rolePrompt: string,
  injections?: PromptInjections,
): ChatInputMessage[] {
  return applyInjections([
    systemOnly(rolePrompt),
    userMessage([
      "[STORY CONTEXT]",
      vaultContext(outline, chapter),
      "",
      "[CHAPTER TEXT]",
      fullText(chapterText),
      "",
      "[TASK]",
      "Summarize the chapter for continuity, not marketing.",
      "Write 120–180 words in present tense. Record what changes, who learns or decides what, key locations and objects, unresolved threads, and continuity facts the next chapter must respect.",
      "Be factual and specific. Do not praise, analyze, or interpret theme. Do not use headings, bullets, or markdown.",
      "Output only the summary.",
    ].join("\n")),
  ], injections);
}

export function buildChunkSummaryMessages(
  outline: Outline,
  chapter: number,
  chunk: string,
  index: number,
  total: number,
  rolePrompt: string,
  injections?: PromptInjections,
): ChatInputMessage[] {
  const entry = outline.chapters.find((item) => item.number === chapter);
  const display = entry ? chapterDisplayNumber(entry) : chapter;
  return applyInjections([
    systemOnly(rolePrompt),
    userMessage([
      "[TASK]",
      "Summarize this portion of a long chapter for continuity.",
      "Write 90–140 words in present tense. Record events, decisions, revelations, locations, and unresolved threads. Do not praise or analyze. Output only the summary.",
      "",
      `[CHAPTER ${display}, PART ${index} OF ${total}]`,
      fullText(chunk),
      "",
      `NOVEL: ${outline.title}`,
    ].join("\n")),
  ], injections);
}

export function buildCombineSummaryMessages(
  outline: Outline,
  chapter: number,
  partials: string[],
  rolePrompt: string,
  injections?: PromptInjections,
): ChatInputMessage[] {
  const entry = outline.chapters.find((item) => item.number === chapter);
  const display = entry ? chapterDisplayNumber(entry) : chapter;
  return applyInjections([
    systemOnly(rolePrompt),
    userMessage([
      "[TASK]",
      "Combine these ordered partial summaries into one chapter summary.",
      "Write 120–180 words in present tense, preserving cause and effect. Do not add facts. No headings or bullets. Output only the summary.",
      "",
      `[CHAPTER ${display} PARTIAL SUMMARIES]`,
      ...partials.map((part, index) => `PART ${index + 1}:\n${part}`),
      "",
      `NOVEL: ${outline.title}`,
    ].join("\n")),
  ], injections);
}

export function splitForSummary(text: string, limit = 40_000): string[] {
  const clean = text.trim();
  if (clean.length <= limit) return [clean];
  const paragraphs = clean.split(/\n{2,}/);
  const chunks: string[] = [];
  let current = "";
  for (const paragraph of paragraphs) {
    if (current.length + paragraph.length + 2 > limit && current) {
      chunks.push(current);
      current = "";
    }
    if (paragraph.length > limit) {
      for (let offset = 0; offset < paragraph.length; offset += limit) {
        chunks.push(paragraph.slice(offset, offset + limit));
      }
      continue;
    }
    current += (current ? "\n\n" : "") + paragraph;
  }
  if (current) chunks.push(current);
  return chunks;
}
