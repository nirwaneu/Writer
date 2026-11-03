import type { ChatMessage, Outline, RoleConfig } from "@/lib/schemas";
import type { ChatInputMessage } from "@/lib/ai/client";
import { PROMPT_DEFAULTS } from "@/lib/ai/prompt-definitions";
import { chapterDisplayNumber, chapterDisplayTitle } from "@/lib/pages";

const MAX_CHAT_CHARS = 26_000;

function fullText(text: string): string {
  return text.trim();
}

function renderPrompt(template: string, values: Record<string, string>): string {
  return template.replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, (match, key: string) => values[key] ?? match);
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

function finalPlan(messages: ChatMessage[]): string {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.role === "assistant" && !message.failed && message.content.trim()) {
      return message.content.trim();
    }
  }
  return "";
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
  options?: { contextPrompt?: string; ack?: string; taskPrompt?: string },
): ChatInputMessage[] {
  const chapterEntry = outline.chapters.find((item) => item.number === chapter);
  const displayNumber = chapterEntry ? chapterDisplayNumber(chapterEntry) : chapter;
  const chapterTitle = chapterEntry ? ` — ${chapterDisplayTitle(chapterEntry)}` : "";
  const chapterStaleSummary = chapterEntry?.summary
    ? `An earlier summary exists and may be stale:\n${fullText(chapterEntry.summary)}`
    : "";
  const context = renderPrompt(options?.contextPrompt ?? PROMPT_DEFAULTS.planner_context, {
    vault: vaultContext(outline, chapter),
    chapter: String(displayNumber),
    chapterTitle,
    chapterStaleSummary,
  });

  const messages: ChatInputMessage[] = [
    systemOnly(rolePrompt),
    userMessage(context),
    {
      role: "assistant",
      content: renderPrompt(options?.ack ?? PROMPT_DEFAULTS.planner_ack, {}),
    },
  ];

  for (const message of recentHistory(history, MAX_CHAT_CHARS)) {
    messages.push({ role: message.role, content: message.content.trim() });
  }

  messages.push(
    userMessage(
      renderPrompt(options?.taskPrompt ?? PROMPT_DEFAULTS.planner_task, {
        message: userMessageText.trim(),
      }),
    ),
  );
  return applyInjections(messages, injections);
}

export function buildExecutorMessages(
  outline: Outline,
  chapter: number,
  history: ChatMessage[],
  rolePrompt: string,
  injections?: PromptInjections,
  options?: { taskPrompt?: string },
): ChatInputMessage[] {
  const chapterEntry = outline.chapters.find((item) => item.number === chapter);
  const displayNumber = chapterEntry ? chapterDisplayNumber(chapterEntry) : chapter;
  const plan = finalPlan(history);
  if (!plan.trim()) {
    throw new Error("NO_PLAN");
  }

  const content = renderPrompt(options?.taskPrompt ?? PROMPT_DEFAULTS.executor_task, {
    vault: vaultContext(outline, chapter),
    chapter: String(displayNumber),
    chapterTitle: chapterEntry ? ` — ${chapterDisplayTitle(chapterEntry)}` : "",
    plan,
  });

  return applyInjections([systemOnly(rolePrompt), userMessage(content)], injections);
}

export function buildPremiseMessages(
  history: ChatMessage[],
  rolePrompt: string,
  injections?: PromptInjections,
  taskPrompt?: string,
): ChatInputMessage[] {
  const chat = transcript(history, 30_000);
  if (!chat.trim()) throw new Error("NO_BRAINSTORM");

  return applyInjections([
    systemOnly(rolePrompt),
    userMessage(renderPrompt(taskPrompt ?? PROMPT_DEFAULTS.premise_task, { chat })),
  ], injections);
}

export function buildTitleMessages(
  history: ChatMessage[],
  premise: string,
  rolePrompt: string,
  injections?: PromptInjections,
  taskPrompt?: string,
): ChatInputMessage[] {
  const chat = transcript(history, 8_000);
  return applyInjections([
    systemOnly(rolePrompt),
    userMessage(
      renderPrompt(taskPrompt ?? PROMPT_DEFAULTS.title_task, {
        premise: fullText(premise),
        notes: chat,
      }),
    ),
  ], injections);
}

export function buildCharacterExtractionMessages(
  outline: Outline,
  rolePrompt: string,
  injections?: PromptInjections,
  taskPrompt?: string,
): ChatInputMessage[] {
  return applyInjections([
    systemOnly(rolePrompt),
    userMessage(
      renderPrompt(taskPrompt ?? PROMPT_DEFAULTS.character_extraction_task, {
        title: fullText(outline.title),
        premise: fullText(outline.premise) || "No premise recorded.",
      }),
    ),
  ], injections);
}

export function buildImagePromptMessages(
  context: { kind: "chapter" | "cover"; title: string; premise: string; summary?: string; previousTitle?: string },
  rolePrompt: string,
  injections?: PromptInjections,
  taskPrompts?: { cover?: string; chapter?: string },
): ChatInputMessage[] {
  const subject =
    context.kind === "cover"
      ? renderPrompt(taskPrompts?.cover ?? PROMPT_DEFAULTS.image_cover_task, {
          title: fullText(context.title),
          premise: fullText(context.premise) || "No premise recorded.",
        })
      : renderPrompt(taskPrompts?.chapter ?? PROMPT_DEFAULTS.image_chapter_task, {
          title: fullText(context.title),
          previousTitle: fullText(context.previousTitle || "Previous chapter"),
          summary: fullText(context.summary || "No previous chapter summary recorded."),
        });

  return applyInjections([systemOnly(rolePrompt), userMessage(subject)], injections);
}

export function buildTitleGenerationMessages(
  context: string,
  rolePrompt: string,
  injections?: PromptInjections,
  taskPrompt?: string,
): ChatInputMessage[] {
  return applyInjections([
    systemOnly(rolePrompt),
    userMessage(
      renderPrompt(taskPrompt ?? PROMPT_DEFAULTS.title_generation_task, {
        text: fullText(context),
      }),
    ),
  ], injections);
}

export function buildChapterTitleMessages(
  outline: Outline,
  chapter: number,
  chapterText: string,
  rolePrompt: string,
  taskPrompt?: string,
): ChatInputMessage[] {
  const entry = outline.chapters.find((item) => item.number === chapter);
  const display = entry ? chapterDisplayNumber(entry) : chapter;
  return [
    systemOnly(rolePrompt),
    userMessage(
      renderPrompt(taskPrompt ?? PROMPT_DEFAULTS.chapter_title_task, {
        title: fullText(outline.title),
        chapter: String(display),
        chapterText: fullText(chapterText),
      }),
    ),
  ];
}

export function buildChapterSummaryMessages(
  outline: Outline,
  chapter: number,
  chapterText: string,
  rolePrompt: string,
  injections?: PromptInjections,
  taskPrompt?: string,
): ChatInputMessage[] {
  return applyInjections([
    systemOnly(rolePrompt),
    userMessage(
      renderPrompt(taskPrompt ?? PROMPT_DEFAULTS.chapter_summary_task, {
        vault: vaultContext(outline, chapter),
        chapterText: fullText(chapterText),
      }),
    ),
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
  taskPrompt?: string,
): ChatInputMessage[] {
  const entry = outline.chapters.find((item) => item.number === chapter);
  const display = entry ? chapterDisplayNumber(entry) : chapter;
  return applyInjections([
    systemOnly(rolePrompt),
    userMessage(
      renderPrompt(taskPrompt ?? PROMPT_DEFAULTS.chunk_summary_task, {
        chapter: String(display),
        part: String(index),
        total: String(total),
        chunk: fullText(chunk),
        title: fullText(outline.title),
      }),
    ),
  ], injections);
}

export function buildCombineSummaryMessages(
  outline: Outline,
  chapter: number,
  partials: string[],
  rolePrompt: string,
  injections?: PromptInjections,
  taskPrompt?: string,
): ChatInputMessage[] {
  const entry = outline.chapters.find((item) => item.number === chapter);
  const display = entry ? chapterDisplayNumber(entry) : chapter;
  const parts = partials.map((part, index) => `PART ${index + 1}:\n${part}`).join("\n\n");
  return applyInjections([
    systemOnly(rolePrompt),
    userMessage(
      renderPrompt(taskPrompt ?? PROMPT_DEFAULTS.combine_summary_task, {
        chapter: String(display),
        partials: parts,
        title: fullText(outline.title),
      }),
    ),
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
