"use client";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  ArrowUp,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  PencilLine,
  RefreshCw,
  Square,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { LocalTime } from "@/components/relative-time";
import { ReasoningBlock } from "@/components/chat/reasoning-block";
import { cn } from "@/lib/utils";
import type { ChatAlternative, ChatMessage } from "@/lib/schemas";
import type { ChatFailure } from "@/lib/chat-types";

export type { ChatFailure };

export function ChatThread({
  messages,
  streamingContent,
  streamingReasoning = "",
  streaming,
  error,
  onSend,
  onRetry,
  onStop,
  onRegenerate,
  onDeleteMessage,
  onSwitchVersion,
  onEditMessage,
  disabled = false,
  placeholder = "Write to the Planner…",
  empty,
  suggestions,
  compact = false,
  footer,
}: {
  messages: ChatMessage[];
  streamingContent: string;
  streamingReasoning?: string;
  streaming: boolean;
  error: ChatFailure;
  onSend: (text: string) => void;
  onRetry: () => void;
  onStop: () => void;
  onRegenerate?: (message: ChatMessage) => void;
  onDeleteMessage?: (message: ChatMessage) => void;
  onSwitchVersion?: (message: ChatMessage, alternativeId: string) => void;
  onEditMessage?: (message: ChatMessage, content: string) => void | Promise<void>;
  disabled?: boolean;
  placeholder?: string;
  empty?: React.ReactNode;
  suggestions?: string[];
  compact?: boolean;
  footer?: React.ReactNode;
}) {
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const atBottomRef = useRef(true);

  useEffect(() => {
    const element = textareaRef.current;
    if (!element) return;
    element.style.height = "auto";
    element.style.height = `${Math.min(element.scrollHeight, compact ? 140 : 200)}px`;
  }, [draft, compact]);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    if (atBottomRef.current) {
      element.scrollTop = element.scrollHeight;
    }
  }, [messages, streamingContent, streamingReasoning, streaming]);

  function onScroll() {
    const element = scrollRef.current;
    if (!element) return;
    const distance = element.scrollHeight - element.scrollTop - element.clientHeight;
    atBottomRef.current = distance < 80;
  }

  function submit() {
    const text = draft.trim();
    if (!text || streaming || disabled) return;
    setDraft("");
    onSend(text);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  }

  const emptyState = !messages.length && !streaming;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div
        ref={scrollRef}
        onScroll={onScroll}
        className={cn("min-h-0 flex-1 overflow-y-auto", compact ? "px-4 py-4" : "px-5 py-6 sm:px-8")}
      >
        <div className={cn("mx-auto flex w-full flex-col", compact ? "max-w-none gap-4" : "max-w-3xl gap-6")}>
          {emptyState ? (
            <div className="py-4">
              {empty}
              {suggestions?.length ? (
                <div className="mt-5 flex flex-wrap gap-2">
                  {suggestions.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => onSend(suggestion)}
                      disabled={disabled}
                      className="rounded-full border border-border bg-[#0d131a] px-3 py-1.5 text-left text-[11.5px] leading-snug text-muted-foreground transition-colors hover:border-[#3a4a5b] hover:bg-white/[0.04] hover:text-foreground disabled:opacity-50"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

          {messages.map((message) => (
            <MessageBlock
              key={message.id}
              message={message}
              compact={compact}
              streaming={streaming}
              onRegenerate={onRegenerate}
              onDeleteMessage={onDeleteMessage}
              onSwitchVersion={onSwitchVersion}
              onEditMessage={onEditMessage}
            />
          ))}

          {streaming ? (
            <div className="animate-fade-in">
              <div className="mb-1.5 flex items-center gap-2">
                <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-[#f2c477]">
                  Planner
                </span>
                <span className="font-mono text-[9px] text-muted-foreground/70">writing</span>
              </div>
              {streamingReasoning ? (
                <ReasoningBlock reasoning={streamingReasoning} streaming />
              ) : null}
              {streamingContent ? (
                <div className="chat-prose text-foreground/90">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{streamingContent}</ReactMarkdown>
                  <span className="streaming-caret" />
                </div>
              ) : (
                <ThinkingLine />
              )}
            </div>
          ) : null}

          {error ? (
            <div className="flex items-start gap-2.5 rounded-md border border-[#5a2c25] bg-[#241411] p-3 text-[12px] leading-relaxed text-[#f2937f]">
              <CircleAlert className="mt-0.5 size-4 shrink-0" />
              <div className="min-w-0 flex-1">
                <p>{error.message}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {error.retryable ? (
                    <Button size="sm" variant="secondary" onClick={onRetry}>
                      <RefreshCw />
                      Try again
                    </Button>
                  ) : null}
                  {error.saved ? (
                    <span className="text-[11px] text-[#c7a49c]">Your text was saved.</span>
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <div
        className={cn(
          "shrink-0 border-t border-border bg-[#0b1016]",
          compact ? "px-3 pb-3 pt-3" : "px-5 py-4 sm:px-8",
        )}
      >
        <div className={cn("mx-auto w-full", compact ? "max-w-none" : "max-w-3xl")}>
          <div className="relative rounded-md border border-input bg-[#0c1218] transition-colors focus-within:border-[#5b4a2c] focus-within:ring-2 focus-within:ring-ring/30">
            <textarea
              ref={textareaRef}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              disabled={disabled || streaming}
              rows={1}
              className="max-h-[200px] min-h-[42px] w-full resize-none bg-transparent px-3 py-2.5 pr-20 text-[13px] leading-relaxed text-foreground outline-none placeholder:text-muted-foreground disabled:opacity-60"
            />
            <div className="absolute bottom-2 right-2 flex items-center gap-1">
              {streaming ? (
                <Button size="icon-sm" variant="secondary" onClick={onStop} aria-label="Stop generating">
                  <Square className="size-3 fill-current" />
                </Button>
              ) : (
                <Button
                  size="icon-sm"
                  onClick={submit}
                  disabled={disabled || !draft.trim()}
                  aria-label="Send message"
                >
                  <ArrowUp />
                </Button>
              )}
            </div>
          </div>
          <div className="mt-1.5 flex items-center justify-between gap-3 text-[10px] text-muted-foreground">
            <span>
              <kbd className="font-mono">Enter</kbd> to send ·{" "}
              <kbd className="font-mono">Shift + Enter</kbd> for a new line
            </span>
            {streaming ? <span className="text-[#f2c477]">Generating…</span> : null}
          </div>
          {footer}
        </div>
      </div>
    </div>
  );
}

function MessageBlock({
  message,
  compact,
  streaming,
  onRegenerate,
  onDeleteMessage,
  onSwitchVersion,
  onEditMessage,
}: {
  message: ChatMessage;
  compact: boolean;
  streaming: boolean;
  onRegenerate?: (message: ChatMessage) => void;
  onDeleteMessage?: (message: ChatMessage) => void;
  onSwitchVersion?: (message: ChatMessage, alternativeId: string) => void;
  onEditMessage?: (message: ChatMessage, content: string) => void | Promise<void>;
}) {
  const isUser = message.role === "user";
  const alternatives: ChatAlternative[] = message.alternatives?.length
    ? message.alternatives
    : [
        {
          id: message.id,
          content: message.content,
          reasoning: message.reasoning,
          createdAt: message.createdAt,
          model: message.model,
          failed: message.failed,
        },
      ];
  const activeIndex = Math.max(
    0,
    alternatives.findIndex(
      (alternative) => alternative.id === message.activeAlternativeId,
    ),
  );
  const active = alternatives[activeIndex] ?? alternatives[0];

  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(message.content);

  async function saveEdit() {
    if (!onEditMessage) return;
    const trimmed = editText.trim();
    if (!trimmed) return;
    await onEditMessage(message, trimmed);
    setEditing(false);
  }

  const canSwitch = alternatives.length > 1 && Boolean(onSwitchVersion);

  return (
    <div className="group animate-fade-in">
      <div className="mb-1.5 flex items-center gap-2">
        <span
          className={cn(
            "font-mono text-[9px] uppercase tracking-[0.16em]",
            isUser ? "text-muted-foreground" : "text-[#f2c477]",
          )}
        >
          {isUser ? "You" : "Planner"}
        </span>
        <span className="font-mono text-[9px] text-muted-foreground/70">
          <LocalTime value={active?.createdAt ?? message.createdAt} />
        </span>
        {active?.failed ? (
          <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-[#f2937f]">
            interrupted
          </span>
        ) : null}
        {canSwitch ? (
          <span className="font-mono text-[9px] text-muted-foreground/70">
            {activeIndex + 1} / {alternatives.length}
          </span>
        ) : null}
      </div>

      {isUser ? (
        editing ? (
          <div className="space-y-2">
            <textarea
              value={editText}
              onChange={(event) => setEditText(event.target.value)}
              rows={3}
              className="w-full resize-none rounded-md border border-input bg-[#0c1218] px-3 py-2 text-[13px] leading-relaxed text-foreground outline-none focus:border-[#5b4a2c] focus:ring-2 focus:ring-ring/30"
              autoFocus
            />
            <p className="text-[10.5px] leading-relaxed text-muted-foreground">
              Saving resends from this prompt. Later messages in this branch are replaced.
            </p>
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={() => void saveEdit()} disabled={!editText.trim()}>
                <Check />
                Save & resend
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setEditing(false);
                  setEditText(message.content);
                }}
              >
                <X />
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <p
            className={cn(
              "whitespace-pre-wrap break-words text-[13px] leading-relaxed text-foreground/90",
              compact && "text-[12.5px]",
            )}
          >
            {message.content}
          </p>
        )
      ) : (
        <>
          {active?.reasoning ? <ReasoningBlock reasoning={active.reasoning} /> : null}
          <div
            className={cn(
              "chat-prose text-foreground/90",
              active?.failed && "opacity-70",
              compact && "text-[12.5px]",
            )}
          >
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{active?.content ?? ""}</ReactMarkdown>
          </div>
        </>
      )}

      <div className="mt-1 flex flex-wrap items-center gap-0.5 opacity-70 transition-opacity focus-within:opacity-100 group-hover:opacity-100 sm:opacity-0">
        {canSwitch ? (
          <div className="flex items-center rounded-[4px] border border-border bg-[#0c1218]">
            <button
              type="button"
              aria-label="Previous response version"
              disabled={activeIndex <= 0 || streaming}
              onClick={() => onSwitchVersion?.(message, alternatives[activeIndex - 1].id)}
              className="flex size-6 items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-30"
            >
              <ChevronLeft className="size-3" />
            </button>
            <span className="px-1 font-mono text-[9px] tabular text-muted-foreground">
              {activeIndex + 1}/{alternatives.length}
            </span>
            <button
              type="button"
              aria-label="Next response version"
              disabled={activeIndex >= alternatives.length - 1 || streaming}
              onClick={() => onSwitchVersion?.(message, alternatives[activeIndex + 1].id)}
              className="flex size-6 items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-30"
            >
              <ChevronRight className="size-3" />
            </button>
          </div>
        ) : null}

        {!isUser && onRegenerate ? (
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Regenerate response"
            title="Regenerate response"
            disabled={streaming}
            onClick={() => onRegenerate(message)}
          >
            <RefreshCw className="size-3.5" />
          </Button>
        ) : null}

        {!isUser && onDeleteMessage ? (
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Delete response version"
            title="Delete this version"
            disabled={streaming}
            className="hover:text-[#f2937f]"
            onClick={() => void onDeleteMessage(message)}
          >
            <Trash2 className="size-3.5" />
          </Button>
        ) : null}

        {isUser && onEditMessage && !editing ? (
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Edit message"
            title="Edit and resend"
            disabled={streaming}
            onClick={() => {
              setEditText(message.content);
              setEditing(true);
            }}
          >
            <PencilLine className="size-3.5" />
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function ThinkingLine() {
  return (
    <div className="flex items-center gap-2 py-1 text-[12px] text-muted-foreground">
      <span className="flex gap-1">
        <span className="size-1 animate-pulse-dot rounded-full bg-primary [animation-delay:0ms]" />
        <span className="size-1 animate-pulse-dot rounded-full bg-primary [animation-delay:180ms]" />
        <span className="size-1 animate-pulse-dot rounded-full bg-primary [animation-delay:360ms]" />
      </span>
      The Planner is thinking.
    </div>
  );
}
