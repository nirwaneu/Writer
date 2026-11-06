"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { Markdown } from "@tiptap/markdown";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Loader2,
  RefreshCw,
  Sparkles,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { SurgicalPreset } from "@/lib/schemas";

type SurgicalSelection = {
  from: number;
  to: number;
  text: string;
  top: number;
  left: number;
};

type SurgicalReview = {
  from: number;
  to: number;
  original: string;
  takes: string[];
  index: number;
  before: string;
  after: string;
  instruction: string;
};

function lastParagraph(text: string): string {
  return (
    text
      .split(/\n+/)
      .map((part) => part.trim())
      .filter(Boolean)
      .at(-1) ?? ""
  );
}

function firstParagraph(text: string): string {
  return (
    text
      .split(/\n+/)
      .map((part) => part.trim())
      .filter(Boolean)[0] ?? ""
  );
}

function clampAnchor(center: number, width: number): number {
  if (typeof window === "undefined") return center;
  return Math.max(8, Math.min(center - width / 2, window.innerWidth - width - 8));
}

export function MarkdownEditor({
  value,
  onChange,
  streaming = false,
  streamingText = "",
  readOnly = false,
  placeholder = "Start writing, or let the Executor draft from the plan.",
  className,
  onStreamApplied,
  surgical,
  onSurgicalCommit,
}: {
  value: string;
  onChange: (markdown: string) => void;
  streaming?: boolean;
  streamingText?: string;
  readOnly?: boolean;
  placeholder?: string;
  className?: string;
  onStreamApplied?: () => void;
  surgical?: { slug: string; chapter: number };
  onSurgicalCommit?: (markdown: string) => void;
}) {
  const applyingRef = useRef(false);
  const pendingRef = useRef<string | null>(null);
  const frameRef = useRef<number | null>(null);
  const onStreamAppliedRef = useRef(onStreamApplied);
  const reviewRef = useRef<SurgicalReview | null>(null);
  const polishingRef = useRef(false);
  const surgicalRunRef = useRef(0);
  const surgicalAbortRef = useRef<AbortController | null>(null);
  const repolishRef = useRef<() => void>(() => {});
  const uiRef = useRef<HTMLDivElement>(null);

  const [presets, setPresets] = useState<SurgicalPreset[]>([]);
  const [selection, setSelection] = useState<SurgicalSelection | null>(null);
  const [customPrompt, setCustomPrompt] = useState("");
  const [polishing, setPolishing] = useState(false);
  const [surgicalError, setSurgicalError] = useState<string | null>(null);
  const [review, setReview] = useState<SurgicalReview | null>(null);

  const surgicalSlug = surgical?.slug;
  const surgicalChapter = surgical?.chapter;

  useEffect(() => {
    onStreamAppliedRef.current = onStreamApplied;
  }, [onStreamApplied]);

  useEffect(() => {
    return () => {
      surgicalAbortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (!surgicalSlug) return;
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch("/api/surgical-presets?active=1", {
          cache: "no-store",
        });
        const payload = (await response.json().catch(() => null)) as
          | { presets?: SurgicalPreset[] }
          | null;
        if (!cancelled && payload?.presets) setPresets(payload.presets);
      } catch {
        // The floating bar simply shows no presets if this fails.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [surgicalSlug]);

  function setReviewState(next: SurgicalReview | null) {
    reviewRef.current = next;
    setReview(next);
  }

  const editor = useEditor({
    immediatelyRender: false,
    editable: !readOnly && !streaming,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Markdown.configure({
        indentation: { style: "space", size: 2 },
      }),
      Placeholder.configure({
        placeholder,
        emptyEditorClass: "is-empty",
      }),
    ],
    content: value,
    contentType: "markdown",
    editorProps: {
      attributes: {
        class: "manuscript tiptap",
        spellcheck: "true",
        "aria-label": "Chapter manuscript",
      },
    },
    onUpdate: ({ editor: current }) => {
      if (applyingRef.current) return;
      if (!current.isFocused) return;
      onChange(current.getMarkdown());
    },
  });

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(!readOnly && !streaming && !review);
    editor.view.dom.classList.toggle("streaming", streaming);
  }, [editor, readOnly, streaming, review]);

  useEffect(() => {
    if (!editor) return;
    if (streaming) return;
    const current = editor.getMarkdown();
    if (current === value) return;
    applyingRef.current = true;
    editor.commands.setContent(value || "", { contentType: "markdown" });
    applyingRef.current = false;
  }, [editor, value, streaming]);

  useEffect(() => {
    if (!editor || !streaming) return;
    pendingRef.current = streamingText;
    if (frameRef.current !== null) return;
    frameRef.current = window.setTimeout(() => {
      frameRef.current = null;
      const next = pendingRef.current ?? "";
      applyingRef.current = true;
      editor.commands.setContent(next, { contentType: "markdown" });
      applyingRef.current = false;
      onStreamAppliedRef.current?.();
    }, 50);
    return () => {
      if (frameRef.current !== null) {
        clearTimeout(frameRef.current);
        frameRef.current = null;
      }
    };
  }, [editor, streaming, streamingText]);

  useEffect(() => {
    if (!editor || !surgicalSlug) return;
    const handleSelection = () => {
      if (reviewRef.current || polishingRef.current) return;
      if (uiRef.current?.contains(document.activeElement)) return;
      const { from, to } = editor.state.selection;
      if (from === to) {
        setSelection(null);
        return;
      }
      const text = editor.state.doc.textBetween(from, to, "\n");
      if (!text.trim()) {
        setSelection(null);
        return;
      }
      const start = editor.view.coordsAtPos(from);
      const end = editor.view.coordsAtPos(to);
      setSelection({
        from,
        to,
        text,
        top: Math.min(start.top, end.top),
        left: (start.left + end.left) / 2,
      });
    };
    editor.on("selectionUpdate", handleSelection);
    return () => {
      editor.off("selectionUpdate", handleSelection);
    };
  }, [editor, surgicalSlug]);

  const discardReview = useCallback(() => {
    if (!editor) return;
    const current = reviewRef.current;
    if (!current) return;
    surgicalRunRef.current += 1;
    surgicalAbortRef.current?.abort();
    surgicalAbortRef.current = null;
    polishingRef.current = false;
    setPolishing(false);
    if (current.index !== -1) {
      applyingRef.current = true;
      editor.view.dispatch(
        editor.state.tr.insertText(current.original, current.from, current.to),
      );
      applyingRef.current = false;
    }
    setReviewState(null);
    setSelection(null);
    setCustomPrompt("");
    setSurgicalError(null);
  }, [editor]);

  const commitReview = useCallback(() => {
    if (!editor) return;
    if (polishingRef.current) return;
    const markdown = editor.getMarkdown();
    setReviewState(null);
    setSelection(null);
    setCustomPrompt("");
    setSurgicalError(null);
    if (onSurgicalCommit) onSurgicalCommit(markdown);
    else onChange(markdown);
  }, [editor, onChange, onSurgicalCommit]);

  const cancelSurgical = useCallback(() => {
    surgicalRunRef.current += 1;
    surgicalAbortRef.current?.abort();
    surgicalAbortRef.current = null;
    polishingRef.current = false;
    setPolishing(false);
    setSelection(null);
  }, []);

  useEffect(() => {
    if (!editor || !surgicalSlug) return;
    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (uiRef.current?.contains(target)) return;
      if (editor?.view.dom.contains(target)) return;
      if (reviewRef.current) return;
      cancelSurgical();
    }
    function onKeyDown(event: KeyboardEvent) {
      if (
        (event.ctrlKey || event.metaKey) &&
        event.key.toLowerCase() === "r" &&
        reviewRef.current
      ) {
        event.preventDefault();
        repolishRef.current();
        return;
      }
      if (event.key === "Escape") {
        if (reviewRef.current) discardReview();
        else cancelSurgical();
        return;
      }
      if (event.key === "Enter" && reviewRef.current) {
        event.preventDefault();
        commitReview();
      }
    }
    function onScroll(event: Event) {
      if (reviewRef.current) return;
      if (uiRef.current?.contains(event.target as Node)) return;
      cancelSurgical();
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [cancelSurgical, commitReview, discardReview, editor, surgicalSlug]);

  function applyPreview(current: SurgicalReview, index: number) {
    if (!editor) return;
    const text = index < 0 ? current.original : current.takes[index] ?? current.original;
    applyingRef.current = true;
    editor.view.dispatch(
      editor.state.tr.insertText(text, current.from, current.to),
    );
    applyingRef.current = false;
    setReviewState({ ...current, index, to: current.from + text.length });
  }

  async function requestTakes(target: {
    selection: string;
    before: string;
    after: string;
    instruction: string;
  }): Promise<string[] | null> {
    if (!surgicalSlug || !surgicalChapter) return null;
    const runId = surgicalRunRef.current + 1;
    surgicalRunRef.current = runId;
    surgicalAbortRef.current?.abort();
    const controller = new AbortController();
    surgicalAbortRef.current = controller;
    setPolishing(true);
    polishingRef.current = true;
    setSurgicalError(null);
    try {
      const response = await fetch("/api/ai/surgical", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          slug: surgicalSlug,
          chapter: surgicalChapter,
          selection: target.selection,
          before: target.before,
          after: target.after,
          instruction: target.instruction,
        }),
      });
      if (surgicalRunRef.current !== runId) return null;
      const payload = (await response.json().catch(() => null)) as
        | { takes?: string[]; error?: { message?: string } }
        | null;
      if (surgicalRunRef.current !== runId) return null;
      if (!response.ok || !payload?.takes?.length) {
        setSurgicalError(payload?.error?.message || "The surgical edit failed.");
        return null;
      }
      return payload.takes.slice(0, 2);
    } catch (error) {
      if ((error as Error).name === "AbortError") return null;
      setSurgicalError("Could not reach the app server.");
      return null;
    } finally {
      if (surgicalRunRef.current === runId) {
        setPolishing(false);
        polishingRef.current = false;
        surgicalAbortRef.current = null;
      }
    }
  }

  async function runSurgical(instruction: string) {
    if (!editor || !selection || polishing) return;
    const current = selection;
    const before = lastParagraph(
      editor.state.doc.textBetween(0, current.from, "\n"),
    ).slice(-4_000);
    const after = firstParagraph(
      editor.state.doc.textBetween(
        current.to,
        editor.state.doc.content.size,
        "\n",
      ),
    ).slice(0, 4_000);
    const takes = await requestTakes({
      selection: current.text,
      before,
      after,
      instruction,
    });
    if (!takes) return;
    const reviewState: SurgicalReview = {
      from: current.from,
      to: current.to,
      original: current.text,
      takes,
      index: 0,
      before,
      after,
      instruction,
    };
    setReviewState(reviewState);
    applyPreview(reviewState, 0);
  }

  async function repolish() {
    const current = reviewRef.current;
    if (!current || polishing) return;
    const takes = await requestTakes({
      selection: current.original,
      before: current.before,
      after: current.after,
      instruction: current.instruction,
    });
    if (!takes) return;
    const latest = reviewRef.current;
    if (!latest) return;
    const nextTakes = [...latest.takes, ...takes];
    const nextIndex = latest.takes.length;
    const next: SurgicalReview = { ...latest, takes: nextTakes, index: nextIndex };
    setReviewState(next);
    applyPreview(next, nextIndex);
  }

  useEffect(() => {
    repolishRef.current = () => {
      void repolish();
    };
  });

  function submitCustom() {
    const instruction = customPrompt.trim();
    if (!instruction || polishing) return;
    void runSurgical(instruction);
  }

  const anchor = selection;
  const above = anchor ? anchor.top > 260 : true;
  const width = review ? 420 : 560;
  const position = anchor
    ? {
        position: "fixed" as const,
        top: above ? anchor.top - 12 : anchor.top + 26,
        left: clampAnchor(anchor.left, width),
        transform: above ? "translateY(-100%)" : undefined,
        zIndex: 70,
      }
    : undefined;

  const activeText =
    review && review.index >= 0
      ? review.takes[review.index]
      : review?.original ?? "";

  return (
    <div className={cn("relative", className)}>
      <EditorContent editor={editor} />

      {anchor && position ? (
        <div ref={uiRef} style={position} className="w-full max-w-[92vw]">
          {review ? (
            <div className="w-[420px] max-w-[92vw] overflow-hidden rounded-lg border border-[#3a4a5b] bg-[#0e151d] shadow-[0_18px_50px_-12px_rgba(0,0,0,0.85)]">
              <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
                <div className="flex items-center gap-2">
                  {polishing ? (
                    <Loader2 className="size-3.5 animate-spin text-[#f2c477]" />
                  ) : (
                    <Sparkles className="size-3.5 text-[#f2c477]" />
                  )}
                  <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-[#f2c477]">
                    {polishing ? "Re-polishing" : "Surgical Polish"}
                  </span>
                </div>
                <span className="font-mono text-[10px] text-muted-foreground">
                  {review.index < 0
                    ? "Original"
                    : `Take ${review.index + 1} of ${review.takes.length}`}
                </span>
              </div>
              <p
                aria-busy={polishing}
                className={cn(
                  "max-h-40 overflow-y-auto px-3 py-2.5 text-[12.5px] leading-relaxed text-foreground/90",
                  polishing && "animate-pulse opacity-60",
                )}
              >
                {activeText}
              </p>
              <div className="flex items-center justify-between gap-2 border-t border-border px-2 py-1.5">
                <div className="flex items-center gap-0.5">
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label="Previous variation"
                    disabled={polishing || review.index <= -1}
                    onClick={() =>
                      applyPreview(review, Math.max(-1, review.index - 1))
                    }
                  >
                    <ChevronLeft />
                  </Button>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label="Next variation"
                    disabled={polishing || review.index >= review.takes.length - 1}
                    onClick={() =>
                      applyPreview(
                        review,
                        Math.min(review.takes.length - 1, review.index + 1),
                      )
                    }
                  >
                    <ChevronRight />
                  </Button>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label="Re-polish"
                    title="Generate new takes using the same instruction (Ctrl/Cmd+R)"
                    disabled={polishing}
                    onClick={() => void repolish()}
                  >
                    {polishing ? <Loader2 className="animate-spin" /> : <RefreshCw />}
                  </Button>
                </div>
                <div className="flex items-center gap-1">
                  <Button size="sm" variant="ghost" onClick={discardReview}>
                    <X />
                    Cancel
                  </Button>
                  <Button size="sm" onClick={commitReview} disabled={polishing}>
                    <Check />
                    Commit
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="w-[560px] max-w-[92vw] overflow-hidden rounded-lg border border-[#3a4a5b] bg-[#0e151d] p-2 shadow-[0_18px_50px_-12px_rgba(0,0,0,0.85)]">
              <div className="flex flex-wrap items-center gap-1.5">
                {presets.map((preset) => (
                  <Button
                    key={preset.id}
                    size="sm"
                    variant="secondary"
                    className="h-7 px-2 text-[11px]"
                    disabled={polishing}
                    onClick={() => void runSurgical(preset.instruction)}
                  >
                    <span className="text-[12px]">{preset.icon || "✨"}</span>
                    {preset.label}
                  </Button>
                ))}
                {polishing ? (
                  <span className="ml-auto flex items-center gap-1.5 text-[10.5px] text-muted-foreground">
                    <Loader2 className="size-3.5 animate-spin" />
                    Polishing…
                  </span>
                ) : null}
              </div>
              <div className="mt-2 flex items-center gap-1.5">
                <Input
                  value={customPrompt}
                  onChange={(event) => setCustomPrompt(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      submitCustom();
                    }
                  }}
                  placeholder="Custom direction… e.g. make him sound reluctant"
                  disabled={polishing}
                  className="h-7 text-[11.5px]"
                />
                <Button
                  size="icon-sm"
                  aria-label="Apply custom direction"
                  disabled={polishing || !customPrompt.trim()}
                  onClick={submitCustom}
                >
                  <ChevronRight />
                </Button>
              </div>
              {surgicalError ? (
                <p className="mt-1.5 text-[10.5px] leading-relaxed text-[#f2937f]">
                  {surgicalError}
                </p>
              ) : null}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}