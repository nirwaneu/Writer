"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  ChevronDown,
  CircleAlert,
  Download,
  FileText,
  Loader2,
  PencilLine,
  RefreshCw,
  Save,
  SkipForward,
  Sparkles,
  Square,
  Wand2,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChatThread } from "@/components/chat/chat-thread";
import { BookSettingsDialog } from "@/components/workspace/book-settings-dialog";
import { AddPageMenu } from "@/components/workspace/add-page-menu";
import { DebugModeToggle } from "@/components/debug/debug-mode-toggle";
import { MarkdownEditor } from "@/components/editor/markdown-editor";
import { OutlineView } from "@/components/outline/outline-view";
import { StatusDot } from "@/components/status-dot";
import { ReadingToolbar } from "@/components/reading/reading-toolbar";
import { ReasoningBlock } from "@/components/chat/reasoning-block";
import { IllustrationPanel } from "@/components/illustration/illustration-panel";
import { CharacterEditorDialog } from "@/components/book/character-editor-dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { chapterStatusMeta } from "@/lib/chapter-status";
import { usePlannerStream } from "@/lib/use-chat-stream";
import { useExecutorStream } from "@/lib/streams/use-executor-stream";
import { withDebugPreview } from "@/lib/ai/debug-preview";
import { modelDisplayId } from "@/lib/ai/routing";
import { chapterDisplayNumber, chapterDisplayTitle, pageKindLabel } from "@/lib/pages";
import {
  readingPageWidth,
  readingPaperStyle,
  useReadingPreferences,
} from "@/lib/reading-preferences";
import { cn, formatRelative, readingTime, wordCount } from "@/lib/utils";
import type { Chapter, Character, ChatMessage, Outline } from "@/lib/schemas";

type SaveState = "saved" | "dirty" | "saving" | "error" | "conflict";
type SummaryState = "idle" | "running" | "saved" | "failed";

function isNearBottom(element: HTMLElement, threshold = 40): boolean {
  return element.scrollHeight - element.scrollTop - element.clientHeight < threshold;
}

const numberFormat = new Intl.NumberFormat("en");

type WorkspaceViewProps = {
  slug: string;
  initialOutline: Outline;
  chapterNumber: number;
  initialContent: string;
  initialChatMessages: ChatMessage[];
  plannerModel: string;
  executorModel: string;
  summarizerModel: string;
  imageProviders: Array<{ id: string; name: string }>;
};

export function WorkspaceView(props: WorkspaceViewProps) {
  return (
    <WorkspaceSession
      key={`${props.slug}-${props.chapterNumber}`}
      {...props}
    />
  );
}

function WorkspaceSession({
  slug,
  initialOutline,
  chapterNumber,
  initialContent,
  initialChatMessages,
  plannerModel,
  executorModel,
  summarizerModel,
  imageProviders,
}: WorkspaceViewProps) {
  const router = useRouter();
  const initialChapter =
    initialOutline.chapters.find((chapter) => chapter.number === chapterNumber) ??
    initialOutline.chapters[0];

  const [outline, setOutline] = useState(initialOutline);
  const [content, setContent] = useState(initialContent);
  const [savedContent, setSavedContent] = useState(initialContent);
  const [chapterUpdatedAt, setChapterUpdatedAt] = useState(initialChapter.updatedAt);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [executionError, setExecutionError] = useState<string | null>(null);
  const [lastExecutionReasoning, setLastExecutionReasoning] = useState("");
  const [summaryState, setSummaryState] = useState<SummaryState>(
    initialChapter.status === "summarized" && !initialChapter.summaryStale
      ? "saved"
      : initialChapter.status === "summary_failed"
        ? "failed"
        : "idle",
  );
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [skipOpen, setSkipOpen] = useState(false);
  const [advancing, setAdvancing] = useState(false);
  const [skipping, setSkipping] = useState(false);
  const [railTab, setRailTab] = useState<"plan" | "vault">("plan");
  const [mobileView, setMobileView] = useState<"write" | "plan">("write");
  const [isDesktop, setIsDesktop] = useState(true);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [generatingCharacters, setGeneratingCharacters] = useState(false);
  const [savingCharacters, setSavingCharacters] = useState(false);
  const [characterEditorOpen, setCharacterEditorOpen] = useState(false);
  const [charactersError, setCharactersError] = useState<string | null>(null);
  const [deletingPageNumber, setDeletingPageNumber] = useState<number | null>(null);
  const [chapterTitleOpen, setChapterTitleOpen] = useState(false);
  const [chapterTitleDraft, setChapterTitleDraft] = useState("");
  const [generatingChapterTitle, setGeneratingChapterTitle] = useState(false);
  const [savingChapterTitle, setSavingChapterTitle] = useState(false);
  const [chapterTitleError, setChapterTitleError] = useState<string | null>(null);
  const reading = useReadingPreferences();
  const [models, setModels] = useState({
    planner: plannerModel,
    executor: executorModel,
    summarizer: summarizerModel,
  });

  const contentRef = useRef(initialContent);
  const savedContentRef = useRef(initialContent);
  const updatedAtRef = useRef(initialChapter.updatedAt);
  const handledExecutionRef = useRef<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const followStreamRef = useRef(false);
  const savingRef = useRef<Promise<boolean> | null>(null);
  const saveNowRef = useRef<(force?: boolean) => Promise<boolean>>(async () => true);
  const executeRef = useRef<() => void>(() => undefined);

  const planner = usePlannerStream({
    streamKey: `planner:chapter:${slug}:${chapterNumber}`,
    endpoint: "/api/ai/planner",
    initialMessages: initialChatMessages,
    baseBody: { scope: "chapter", slug, chapter: chapterNumber },
    mutateEndpoint: `/api/novels/${slug}/chats/${chapterNumber}`,
  });
  const executor = useExecutorStream({ slug, chapter: chapterNumber });
  const executing = executor.executing;
  const executionText = executor.text;

  const chapter =
    outline.chapters.find((item) => item.number === chapterNumber) ?? initialChapter;
  const isIllustration = chapter.kind === "illustration";
  const displayNumber = chapterDisplayNumber(chapter);
  const dirty = content !== savedContent;
  const hasContent = content.trim().length > 0;
  const planReady = planner.messages.some(
    (message) => message.role === "assistant" && !message.failed,
  );
  const summaryFresh = chapter.status === "summarized" && !chapter.summaryStale;
  const summarySkipped = chapter.status === "summary_skipped";
  const readyToContinue = hasContent && (summaryFresh || summarySkipped) && !executing;
  const visibleContent = executing ? executionText : content;
  const visibleReasoning = executing ? executor.reasoning : lastExecutionReasoning;
  const words = useMemo(() => wordCount(visibleContent), [visibleContent]);
  const meta = chapterStatusMeta(chapter.status, chapter.summaryStale);

  useEffect(() => {
    contentRef.current = content;
  }, [content]);

  useEffect(() => {
    savedContentRef.current = savedContent;
  }, [savedContent]);

  useEffect(() => {
    updatedAtRef.current = chapterUpdatedAt;
  }, [chapterUpdatedAt]);

  useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px)");
    const update = () => setIsDesktop(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  const scrollToStreamBottom = useCallback(() => {
    followStreamRef.current = true;
    setShowScrollButton(false);
    const scroller = scrollRef.current;
    if (scroller) {
      scroller.scrollTop = scroller.scrollHeight;
    }
  }, []);

  const handleEditorScroll = useCallback(() => {
    const scroller = scrollRef.current;
    if (!scroller) return;
    const atBottom = isNearBottom(scroller);
    followStreamRef.current = atBottom;
    if (executing) setShowScrollButton(!atBottom);
  }, [executing]);

  const handleStreamApplied = useCallback(() => {
    if (!followStreamRef.current) return;
    const scroller = scrollRef.current;
    if (scroller) scroller.scrollTop = scroller.scrollHeight;
  }, []);

  const applyChapter = useCallback((next: Chapter) => {
    setOutline((current) => ({
      ...current,
      chapters: current.chapters.map((item) => (item.number === next.number ? next : item)),
    }));
  }, []);

  const refreshChapter = useCallback(async () => {
    try {
      const response = await fetch(`/api/novels/${slug}/chapters/${chapterNumber}`, {
        cache: "no-store",
      });
      if (!response.ok) return false;
      const payload = (await response.json()) as {
        chapter?: Chapter;
        content: string;
        outline: Outline;
      };
      setOutline(payload.outline);
      const text = payload.content ?? "";
      setContent(text);
      contentRef.current = text;
      setSavedContent(text);
      savedContentRef.current = text;
      if (payload.chapter) {
        setChapterUpdatedAt(payload.chapter.updatedAt);
        updatedAtRef.current = payload.chapter.updatedAt;
      }
      setSaveState("saved");
      setSaveError(null);
      return true;
    } catch {
      return false;
    }
  }, [slug, chapterNumber]);

  const refreshOutline = useCallback(async () => {
    try {
      const response = await fetch(`/api/novels/${slug}`, { cache: "no-store" });
      if (!response.ok) return;
      const payload = (await response.json()) as { outline: Outline };
      setOutline(payload.outline);
    } catch {
      // Keep the current outline if the refresh fails.
    }
  }, [slug]);

  const saveNow = useCallback(
    async (force = false): Promise<boolean> => {
      if (savingRef.current) await savingRef.current;
      if (!force && contentRef.current === savedContentRef.current) return true;

      const snapshot = contentRef.current;
      setSaveState("saving");
      setSaveError(null);

      const promise = (async () => {
        try {
          const response = await fetch(`/api/novels/${slug}/chapters/${chapterNumber}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              content: snapshot,
              ...(force ? {} : { expectedUpdatedAt: updatedAtRef.current }),
            }),
          });
          const payload = (await response.json().catch(() => ({}))) as {
            chapter?: Chapter;
            outline?: Outline;
            error?: { message?: string };
          };
          if (!response.ok) {
            if (response.status === 409) {
              setSaveState("conflict");
              setSaveError(
                payload.error?.message ||
                  "This chapter changed in another tab. Reload or overwrite.",
              );
            } else {
              setSaveState("error");
              setSaveError(payload.error?.message || "The chapter could not be saved.");
            }
            return false;
          }
          savedContentRef.current = snapshot;
          setSavedContent(snapshot);
          if (payload.chapter) {
            updatedAtRef.current = payload.chapter.updatedAt;
            setChapterUpdatedAt(payload.chapter.updatedAt);
            applyChapter(payload.chapter);
          }
          if (payload.outline) setOutline(payload.outline);
          setSaveState(contentRef.current === snapshot ? "saved" : "dirty");
          setLastSavedAt(new Date());
          return true;
        } catch {
          setSaveState("error");
          setSaveError("Could not reach the app server. Your text is still in the page.");
          return false;
        }
      })();

      savingRef.current = promise;
      const result = await promise;
      savingRef.current = null;
      return result;
    },
    [applyChapter, chapterNumber, slug],
  );

  useEffect(() => {
    saveNowRef.current = saveNow;
  }, [saveNow]);

  useEffect(() => {
    if (
      !dirty ||
      executing ||
      saveState === "conflict" ||
      saveState === "error" ||
      saveState === "saving"
    ) {
      return;
    }
    const timer = setTimeout(() => {
      void saveNowRef.current();
    }, 1200);
    return () => clearTimeout(timer);
  }, [content, dirty, executing, saveState]);

  useEffect(() => {
    function onBeforeUnload(event: BeforeUnloadEvent) {
      if (contentRef.current !== savedContentRef.current) {
        event.preventDefault();
        event.returnValue = "";
      }
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  useEffect(() => {
    return () => {
      if (contentRef.current !== savedContentRef.current) {
        void fetch(`/api/novels/${slug}/chapters/${chapterNumber}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content: contentRef.current,
            expectedUpdatedAt: updatedAtRef.current,
          }),
          keepalive: true,
        }).catch(() => undefined);
      }
    };
  }, [slug, chapterNumber]);

  const updateContent = useCallback((next: string) => {
    contentRef.current = next;
    setContent(next);
    setSaveState((current) => (current === "conflict" ? "conflict" : "dirty"));
  }, []);

  const runSummary = useCallback(async () => {
    setSummaryState("running");
    setSummaryError(null);
    const fired = await withDebugPreview(
      "/api/ai/summarize",
      { slug, chapter: chapterNumber },
      async (finalBody) => {
        try {
          const response = await fetch("/api/ai/summarize", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(finalBody),
          });
          const payload = (await response.json()) as {
            outline?: Outline;
            error?: { message?: string };
          };
          if (!response.ok || !payload.outline) {
            setSummaryState("failed");
            setSummaryError(payload.error?.message || "The chapter could not be summarized.");
            await refreshOutline();
            return;
          }
          setOutline(payload.outline);
          setSummaryState("saved");
          toast.success("Chapter summary and title saved.");
        } catch {
          setSummaryState("failed");
          setSummaryError("Could not reach the app server while summarizing.");
          await refreshOutline();
        }
      },
    );
    if (!fired) setSummaryState("idle");
  }, [chapterNumber, refreshOutline, slug]);

  const handleSummarize = useCallback(async () => {
    const ok = await saveNow();
    if (!ok) {
      toast.error("Save the chapter before summarizing it.");
      return;
    }
    await runSummary();
  }, [runSummary, saveNow]);

  const startExecution = useCallback(async () => {
    if (!planReady || executing) return;
    setConfirmOpen(false);
    const saved = await saveNow();
    if (!saved) {
      toast.error("The chapter could not be saved before executing.");
      return;
    }

    setExecutionError(null);
    setLastExecutionReasoning("");
    setSummaryError(null);
    setSummaryState("idle");
    setMobileView("write");
    const scroller = scrollRef.current;
    const atBottom = scroller ? isNearBottom(scroller) : true;
    followStreamRef.current = atBottom;
    setShowScrollButton(!atBottom);
    executor.start({
      slug,
      chapter: chapterNumber,
      confirmOverwrite: true,
    });
  }, [chapterNumber, executing, executor, planReady, saveNow, slug]);

  useEffect(() => {
    if (!executing) return;
    const frame = requestAnimationFrame(() => {
      const scroller = scrollRef.current;
      const atBottom = scroller ? isNearBottom(scroller) : true;
      followStreamRef.current = atBottom;
      setShowScrollButton(!atBottom);
    });
    return () => cancelAnimationFrame(frame);
  }, [executing]);

  useEffect(() => {
    const entry = executor.entry;
    if (!entry || entry.status === "streaming") return;
    const handle = `${entry.startedAt}:${entry.status}:${entry.text.length}:${entry.chapter?.updatedAt ?? ""}`;
    if (handledExecutionRef.current === handle) return;
    handledExecutionRef.current = handle;

    const frame = requestAnimationFrame(() => {
      if (entry.status === "done") {
      setShowScrollButton(false);
      if (entry.reasoning) setLastExecutionReasoning(entry.reasoning);
      if (entry.chapter && entry.text.trim()) {
        contentRef.current = entry.text;
        savedContentRef.current = entry.text;
        setContent(entry.text);
        setSavedContent(entry.text);
        setSaveState("saved");
        setLastSavedAt(new Date());
        updatedAtRef.current = entry.chapter.updatedAt;
        setChapterUpdatedAt(entry.chapter.updatedAt);
        applyChapter(entry.chapter);
        executor.reset();
        toast.success(`Chapter ${displayNumber} drafted.`);
      } else {
        executor.reset();
        void refreshChapter();
      }
      } else if (entry.status === "error") {
        setExecutionError(entry.error?.message || "The Executor stopped.");
        setShowScrollButton(false);
        executor.reset();
        toast.error("The Executor stopped.");
        void refreshChapter();
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [
    applyChapter,
    chapterNumber,
    displayNumber,
    executing,
    executor,
    refreshChapter,
  ]);

  const stopExecution = useCallback(() => {
    executor.stop();
    toast.info("Stopping the Executor. The partial chapter is kept.");
  }, [executor]);

  const requestExecute = useCallback(() => {
    if (!planReady || executing) return;
    if (hasContent) {
      setConfirmOpen(true);
      return;
    }
    void startExecution();
  }, [executing, hasContent, planReady, startExecution]);

  useEffect(() => {
    executeRef.current = requestExecute;
  }, [requestExecute]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const metaKey = event.metaKey || event.ctrlKey;
      if (metaKey && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void saveNowRef.current();
      }
      if (metaKey && event.key === "Enter") {
        event.preventDefault();
        executeRef.current();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  async function navigateToChapter(next: number) {
    if (next === chapterNumber) return;
    const ok = await saveNow();
    if (!ok) {
      toast.error("Save this chapter before leaving it.");
      return;
    }
    router.push(`/novels/${slug}/write?chapter=${next}`);
  }

  async function continueChapter() {
    setAdvancing(true);
    const ok = await saveNow();
    if (!ok) {
      setAdvancing(false);
      toast.error("Save this chapter before continuing.");
      return;
    }
    try {
      const response = await fetch(
        `/api/novels/${slug}/chapters/${chapterNumber}/advance`,
        { method: "POST" },
      );
      const payload = (await response.json()) as {
        outline?: Outline;
        error?: { message?: string };
      };
      if (!response.ok || !payload.outline) {
        toast.error(payload.error?.message || "Could not open the next chapter.");
        return;
      }
      const nextPage =
        payload.outline.chapters
          .filter(
            (item) => item.kind === "chapter" && item.number > chapterNumber,
          )
          .sort((a, b) => a.number - b.number)[0] ?? null;
      router.push(
        `/novels/${slug}/write?chapter=${
          nextPage?.number ?? payload.outline.currentChapter
        }`,
      );
    } catch {
      toast.error("Could not reach the app server.");
    } finally {
      setAdvancing(false);
    }
  }

  async function skipSummary() {
    setSkipping(true);
    try {
      const response = await fetch(
        `/api/novels/${slug}/chapters/${chapterNumber}/skip-summary`,
        { method: "POST" },
      );
      const payload = (await response.json()) as {
        outline?: Outline;
        error?: { message?: string };
      };
      if (!response.ok || !payload.outline) {
        toast.error(payload.error?.message || "The summary could not be skipped.");
        return;
      }
      setOutline(payload.outline);
      setSkipOpen(false);
      toast.info("Summary skipped. The next chapter will run without it.");
    } catch {
      toast.error("Could not reach the app server.");
    } finally {
      setSkipping(false);
    }
  }

  function openChapterTitle() {
    setChapterTitleDraft(
      /^Chapter\s+\d+$/i.test(chapter.title) ? "" : chapter.title,
    );
    setChapterTitleError(null);
    setChapterTitleOpen(true);
  }

  async function generateChapterTitle() {
    setGeneratingChapterTitle(true);
    setChapterTitleError(null);
    try {
      const response = await fetch("/api/ai/title", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug,
          kind: "chapter",
          chapter: chapterNumber,
        }),
      });
      const payload = (await response.json()) as {
        title?: string;
        error?: { message?: string };
      };
      if (!response.ok || !payload.title) {
        setChapterTitleError(
          payload.error?.message || "The chapter title could not be generated.",
        );
        return;
      }
      setChapterTitleDraft(payload.title);
    } catch {
      setChapterTitleError("Could not reach the app server.");
    } finally {
      setGeneratingChapterTitle(false);
    }
  }

  async function saveChapterTitle() {
    if (!chapterTitleDraft.trim()) return;
    setSavingChapterTitle(true);
    setChapterTitleError(null);
    try {
      const response = await fetch(`/api/novels/${slug}/chapters/${chapterNumber}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: chapterTitleDraft.trim() }),
      });
      const payload = (await response.json()) as {
        outline?: Outline;
        error?: { message?: string };
      };
      if (!response.ok || !payload.outline) {
        setChapterTitleError(
          payload.error?.message || "The chapter title could not be saved.",
        );
        return;
      }
      setOutline(payload.outline);
      setChapterTitleOpen(false);
      toast.success("Chapter title saved.");
    } catch {
      setChapterTitleError("Could not reach the app server.");
    } finally {
      setSavingChapterTitle(false);
    }
  }

  async function generateCharacters() {
    setGeneratingCharacters(true);
    setCharactersError(null);
    try {
      const response = await fetch(`/api/novels/${slug}/characters/generate`, {
        method: "POST",
      });
      const payload = (await response.json()) as {
        outline?: Outline;
        error?: { message?: string };
      };
      if (!response.ok || !payload.outline) {
        setCharactersError(
          payload.error?.message || "The characters could not be generated.",
        );
        return;
      }
      setOutline(payload.outline);
      toast.success("Planner extracted the character sheet.");
    } catch {
      setCharactersError("Could not reach the app server.");
    } finally {
      setGeneratingCharacters(false);
    }
  }

  async function saveCharacters(next: Character[]) {
    setSavingCharacters(true);
    setCharactersError(null);
    try {
      const response = await fetch(`/api/novels/${slug}/characters`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ characters: next }),
      });
      const payload = (await response.json()) as {
        outline?: Outline;
        error?: { message?: string };
      };
      if (!response.ok || !payload.outline) {
        setCharactersError(payload.error?.message || "The characters could not be saved.");
        return;
      }
      setOutline(payload.outline);
      setCharacterEditorOpen(false);
      toast.success("Character sheet saved.");
    } catch {
      setCharactersError("Could not reach the app server.");
    } finally {
      setSavingCharacters(false);
    }
  }

  async function saveChapterSummaryEdit(page: Chapter, summary: string) {
    try {
      const response = await fetch(`/api/novels/${slug}/chapters/${page.number}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ summary }),
      });
      const payload = (await response.json()) as {
        outline?: Outline;
        error?: { message?: string };
      };
      if (!response.ok || !payload.outline) {
        toast.error(payload.error?.message || "The summary could not be saved.");
        return;
      }
      setOutline(payload.outline);
      toast.success("Summary saved.");
      router.refresh();
    } catch {
      toast.error("Could not reach the app server.");
    }
  }

  async function deletePage(page: Chapter) {
    setDeletingPageNumber(page.number);
    try {
      const response = await fetch(`/api/novels/${slug}/chapters/${page.number}`, {
        method: "DELETE",
      });
      const payload = (await response.json()) as {
        outline?: Outline;
        error?: { message?: string };
      };
      if (!response.ok || !payload.outline) {
        toast.error(payload.error?.message || "The page could not be deleted.");
        return;
      }
      toast.success("Page deleted.");
      if (page.number === chapterNumber) {
        router.replace(
          `/novels/${slug}/write?chapter=${payload.outline.currentChapter}`,
        );
        router.refresh();
        return;
      }
      setOutline(payload.outline);
      router.refresh();
    } catch {
      toast.error("Could not reach the app server.");
    } finally {
      setDeletingPageNumber(null);
    }
  }

  const characterActions = (
    <>
      <Button
        size="sm"
        variant="secondary"
        onClick={() => void generateCharacters()}
        disabled={generatingCharacters}
      >
        {generatingCharacters ? <Loader2 className="animate-spin" /> : <Sparkles />}
        Generate Characters
      </Button>
      <Button size="sm" variant="ghost" onClick={() => setCharacterEditorOpen(true)}>
        <PencilLine />
        Edit Characters
      </Button>
      {charactersError ? (
        <p className="w-full rounded-md border border-[#5a2c25] bg-[#241411] p-2 text-[10.5px] leading-relaxed text-[#f2937f]">
          {charactersError}
        </p>
      ) : null}
    </>
  );

  const saveLabel =
    saveState === "saving"
      ? "Saving…"
      : saveState === "dirty"
        ? "Unsaved changes"
        : saveState === "error"
          ? "Save failed"
          : saveState === "conflict"
            ? "Changed elsewhere"
            : lastSavedAt
              ? `Saved ${formatRelative(lastSavedAt)}`
              : "Saved";

  const title = isIllustration ? "Illustration" : chapterDisplayTitle(chapter);
  const pageLabel = pageKindLabel(chapter);
  const nextTextPage =
    outline.chapters
      .filter((item) => item.kind === "chapter" && item.number > chapterNumber)
      .sort((a, b) => a.number - b.number)[0] ?? null;
  const nextChapterLabel = nextTextPage
    ? chapterDisplayNumber(nextTextPage)
    : displayNumber + 1;

  const writePane = isIllustration ? (
    <div className="h-full min-h-0">
      <IllustrationPanel
        slug={slug}
        pageNumber={chapterNumber}
        chapter={chapter}
        providers={imageProviders}
        onSaved={setOutline}
        immersive
      />
    </div>
  ) : (
    <div className="relative flex h-full min-h-0 flex-col">
      <div
        ref={scrollRef}
        data-editor-scroll
        onScroll={handleEditorScroll}
        className="min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-6 sm:py-6"
      >
        <div
          className="mx-auto w-full"
          style={{ maxWidth: readingPageWidth(reading.preferences) }}
        >
          {executionError ? (
            <Banner
              tone="danger"
              icon={<CircleAlert className="size-4" />}
              title="The Executor stopped."
              body={executionError}
              actions={
                <>
                  <Button size="sm" variant="secondary" onClick={() => setConfirmOpen(true)}>
                    <RefreshCw />
                    Try again
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setExecutionError(null)}>
                    Dismiss
                  </Button>
                </>
              }
            />
          ) : null}

          {saveState === "conflict" ? (
            <Banner
              tone="danger"
              icon={<CircleAlert className="size-4" />}
              title="This chapter changed elsewhere."
              body={
                saveError ||
                "Another tab saved a newer version. Reload it, or overwrite it with this page."
              }
              actions={
                <>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={async () => {
                      const ok = await refreshChapter();
                      if (ok) toast.success("Reloaded the chapter from disk.");
                    }}
                  >
                    Reload chapter
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={async () => {
                      const ok = await saveNow(true);
                      if (ok) toast.success("Overwrote the chapter with this page.");
                    }}
                  >
                    Overwrite
                  </Button>
                </>
              }
            />
          ) : null}

          {saveState === "error" ? (
            <Banner
              tone="danger"
              icon={<CircleAlert className="size-4" />}
              title="The chapter is not saved."
              body={saveError || "Check the data volume and try again."}
              actions={
                <Button size="sm" variant="secondary" onClick={() => void saveNow()}>
                  <Save />
                  Retry save
                </Button>
              }
            />
          ) : null}

          {executing ? (
            <Banner
              tone="amber"
              icon={<Loader2 className="size-4 animate-spin" />}
              title="The Executor is writing this chapter."
              body={`${numberFormat.format(words)} words so far. You can stop; the partial chapter is kept.`}
              actions={
                <Button size="sm" variant="secondary" onClick={stopExecution}>
                  <Square className="size-3 fill-current" />
                  Stop
                </Button>
              }
            />
          ) : null}

          {!executing && hasContent && !summaryFresh && !summarySkipped ? (
            <Banner
              tone={summaryState === "failed" ? "danger" : "amber"}
              icon={
                summaryState === "running" ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : summaryState === "failed" ? (
                  <CircleAlert className="size-4" />
                ) : (
                  <BookOpen className="size-4" />
                )
              }
              title={
                summaryState === "running"
                  ? "Summarizing this chapter…"
                  : summaryState === "failed"
                    ? "The summary failed."
                    : chapter.summaryStale
                      ? "The chapter summary is out of date."
                      : "This chapter is not in the Story Vault yet."
              }
              body={
                summaryState === "running"
                  ? "The Summarizer is reading the chapter and updating the Story Vault."
                  : summaryState === "failed"
                    ? summaryError || "The chapter is saved. Retry the summary, or skip it."
                    : "The next chapter will only see this one through its summary. Generate it before continuing."
              }
              actions={
                summaryState === "running" ? null : (
                  <>
                    <Button size="sm" variant="secondary" onClick={() => void handleSummarize()}>
                      <RefreshCw />
                      {summaryState === "failed" ? "Retry summary" : "Generate summary"}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setSkipOpen(true)}>
                      <SkipForward />
                      Skip
                    </Button>
                  </>
                )
              }
            />
          ) : null}

          {!executing && hasContent && summarySkipped ? (
            <Banner
              tone="muted"
              icon={<SkipForward className="size-4" />}
              title="Summary skipped."
              body="The next chapter will not receive this chapter's summary. You can still generate one."
              actions={
                <Button size="sm" variant="secondary" onClick={() => void handleSummarize()}>
                  Generate anyway
                </Button>
              }
            />
          ) : null}

          <div className="mb-2 flex flex-wrap items-center justify-between gap-2 px-1">
            {isIllustration ? (
              <div className="flex items-center gap-2 text-[10.5px] text-muted-foreground">
                <StatusDot tone={chapter.image ? "success" : "muted"} />
                {chapter.image ? "Illustration saved" : "Illustration page"}
                <span className="text-muted-foreground/40">·</span>
                <span>Stored locally</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-[10.5px] text-muted-foreground">
                <StatusDot
                  tone={
                    saveState === "error" || saveState === "conflict"
                      ? "danger"
                      : saveState === "dirty"
                        ? "amber"
                        : "success"
                  }
                  pulse={saveState === "saving" || executing}
                />
                {executing ? "Executor writing" : saveLabel}
                <span className="text-muted-foreground/40">·</span>
                <span className="tabular">{numberFormat.format(words)} words</span>
                <span className="text-muted-foreground/40">·</span>
                <span>{readingTime(words)}</span>
              </div>
            )}
            <div className="flex items-center gap-2">
              {!isIllustration ? (
                <div className="hidden items-center gap-2 text-[10px] text-muted-foreground/70 xl:flex">
                  <kbd className="rounded border border-border px-1 font-mono">Ctrl S</kbd> save
                  <kbd className="rounded border border-border px-1 font-mono">Ctrl ↵</kbd> execute
                </div>
              ) : null}
              <ReadingToolbar
                preferences={reading.preferences}
                onChange={reading.update}
              />
            </div>
          </div>

          {visibleReasoning ? (
            <ReasoningBlock
              reasoning={visibleReasoning}
              streaming={executing}
              label="Executor reasoning"
            />
          ) : null}

          <div
            className={cn(
              "paper-sheet rounded-[4px] px-5 py-7 sm:px-10 sm:py-10",
              reading.preferences.theme === "dark" && "paper-dark",
            )}
            style={readingPaperStyle(reading.preferences)}
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="paper-kicker font-mono text-[9px] uppercase tracking-[0.18em]">
                {isIllustration ? "Illustration" : `Chapter ${displayNumber}`}
              </span>
              <span className="h-px w-6 bg-[var(--page-line)]" />
              <span className="paper-kicker font-mono text-[9px] uppercase tracking-[0.14em]">
                {isIllustration ? "Plate" : meta.label}
              </span>
            </div>
            <div className="mt-2 flex items-start justify-between gap-3">
              <h1 className="paper-title text-[2rem] leading-[1.08] tracking-[-0.02em] sm:text-[2.35rem]">
                {title}
              </h1>
              {!isIllustration ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={openChapterTitle}
                  aria-label="Edit or generate chapter title"
                  title="Edit or generate chapter title"
                  className="mt-1 shrink-0"
                >
                  <PencilLine />
                </Button>
              ) : null}
            </div>
            <div className="paper-rule mt-2 h-px w-12" />

            <div className="mt-7">
              {isIllustration ? (
                <IllustrationPanel
                  slug={slug}
                  pageNumber={chapterNumber}
                  chapter={chapter}
                  providers={imageProviders}
                  onSaved={setOutline}
                />
              ) : (
                <MarkdownEditor
                  value={content}
                  onChange={updateContent}
                  streaming={executing}
                  streamingText={executionText}
                  onStreamApplied={handleStreamApplied}
                  placeholder="Start writing, or plan the chapter on the right and press Execute."
                />
              )}
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between gap-3 px-1 text-[10px] text-muted-foreground/80">
            <span>
              {isIllustration
                ? "Image saved under novels/" + slug + "/illustrations/"
                : `Markdown saved as chapters/chapter_${chapterNumber}.md`}
            </span>
            <span className="hidden sm:inline">
              {isIllustration ? "Persistent data volume" : "Auto-saves while you write"}
            </span>
          </div>
        </div>
      </div>
      {executing && showScrollButton ? (
        <button
          type="button"
          onClick={scrollToStreamBottom}
          className="absolute bottom-5 right-5 z-20 inline-flex items-center gap-2 rounded-full border border-border bg-[#11171f] px-3 py-1.5 text-[11px] text-foreground shadow-[0_10px_30px_-8px_rgba(0,0,0,0.8)] transition-colors hover:border-[#3a4a5b] hover:bg-[#18212b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ArrowDown className="size-3.5 text-primary" />
          Scroll to bottom
          <span className="size-1 animate-pulse-dot rounded-full bg-primary" />
        </button>
      ) : null}
    </div>
  );

  const illustrationRail = (
    <div className="flex h-full min-h-0 flex-col bg-[#0a0e13]">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-3 py-2">
        <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-[#f2c477]">
          Illustration plate
        </span>
        <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
          Page {chapterNumber}
        </span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <h2 className="font-serif text-[1.35rem] leading-tight tracking-[-0.01em]">
          A visual pause.
        </h2>
        <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">
          This page separates chapters with an illustration. Use the generation panel on the
          left to choose a provider, model, and aspect ratio. The image is downloaded to the
          data volume and stored in SQLite metadata, so it survives refreshes and rebuilds.
        </p>
        <div className="mt-4 rounded-md border border-border bg-[#0c1218] p-3 text-[11px] leading-relaxed text-muted-foreground">
          <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-foreground/80">
            Storage
          </p>
          <p className="mt-1.5 break-all font-mono text-[10px]">
            data/novels/{slug}/illustrations/
          </p>
        </div>
        <div className="mt-6 border-t border-border pt-4">
          <OutlineView
            outline={outline}
            compact
            characterActions={characterActions}
            onDeletePage={(page) => void deletePage(page)}
            deletingPageNumber={deletingPageNumber}
            onSaveSummary={saveChapterSummaryEdit}
          />
        </div>
      </div>
    </div>
  );

  const planRail = (
    <div className="flex h-full min-h-0 flex-col bg-[#0a0e13]">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-3 py-2">
        <Tabs value={railTab} onValueChange={(value) => setRailTab(value as "plan" | "vault")}>
          <TabsList>
            <TabsTrigger value="plan">Plan</TabsTrigger>
            <TabsTrigger value="vault">Vault</TabsTrigger>
          </TabsList>
        </Tabs>
        <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
          Ch. {displayNumber}
        </span>
      </div>

      {railTab === "plan" ? (
        <ChatThread
          compact
          messages={planner.messages}
          streamingContent={planner.streamingContent}
          streamingReasoning={planner.streamingReasoning}
          streaming={planner.streaming}
          error={planner.error}
          onSend={planner.send}
          onRetry={planner.retry}
          onStop={planner.stop}
          onRegenerate={planner.regenerate}
          onDeleteMessage={planner.deleteMessage}
          onSwitchVersion={planner.switchVersion}
          onEditMessage={planner.editMessage}
          onEditAssistant={planner.editAssistant}
          disabled={executing}
          placeholder={
            planReady
              ? "Refine the plan, or press Execute when it holds."
              : "What must this chapter do?"
          }
          empty={
            <div>
              <h2 className="font-serif text-[1.35rem] leading-tight tracking-[-0.01em]">
                Plan chapter {displayNumber}.
              </h2>
              <p className="mt-1.5 text-[12px] leading-relaxed text-muted-foreground">
                Decide what changes, who wants what, and what stays unresolved. The Executor
                receives only this conversation and the vault.
              </p>
            </div>
          }
          suggestions={
            planReady
              ? undefined
              : [
                  "What does the protagonist want in this chapter, and who stands in the way?",
                  "Give me a six-beat plan that ends on a turn, not a resolution.",
                  "What continuity from the last chapter must this scene respect?",
                ]
          }
          footer={
            <div className="mt-3">
              {readyToContinue ? (
                <>
                  <Button className="w-full" onClick={() => void continueChapter()} disabled={advancing}>
                    {advancing ? <Loader2 className="animate-spin" /> : <ArrowRight />}
                    {advancing ? "Opening…" : `Continue to chapter ${nextChapterLabel}`}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-1.5 w-full text-muted-foreground"
                    onClick={requestExecute}
                    disabled={!planReady}
                  >
                    <Wand2 />
                    Rewrite this chapter
                  </Button>
                </>
              ) : executing ? (
                <Button
                  className="w-full"
                  variant="secondary"
                  onClick={stopExecution}
                >
                  <Square className="size-3 fill-current" />
                  Stop the Executor
                </Button>
              ) : hasContent && !summaryFresh && !summarySkipped ? (
                <>
                  <Button
                    className="w-full"
                    onClick={() => void handleSummarize()}
                    disabled={summaryState === "running"}
                  >
                    {summaryState === "running" ? (
                      <Loader2 className="animate-spin" />
                    ) : (
                      <RefreshCw />
                    )}
                    {summaryState === "running"
                      ? "Summarizing…"
                      : summaryState === "failed"
                        ? "Retry summary"
                        : "Generate summary"}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-1.5 w-full text-muted-foreground"
                    onClick={requestExecute}
                    disabled={!planReady}
                  >
                    <Wand2 />
                    Rewrite this chapter
                  </Button>
                </>
              ) : (
                <Button
                  className="w-full"
                  onClick={requestExecute}
                  disabled={!planReady}
                  title={planReady ? undefined : "Brainstorm the chapter with the Planner first."}
                >
                  <Wand2 />
                  Execute chapter
                </Button>
              )}
              <div className="mt-2 flex items-center justify-between gap-2 pb-1 font-mono text-[9px] text-muted-foreground/75">
                <span className="truncate">Planner · {modelDisplayId(models.planner)}</span>
                <span className="truncate text-right">Executor · {modelDisplayId(models.executor)}</span>
              </div>
            </div>
          }
        />
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <div className="mb-4 border-b border-border pb-4">
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-[#f2c477]">
                Chapter {displayNumber}
              </span>
              <Badge
                variant={
                  meta.tone === "success"
                    ? "success"
                    : meta.tone === "danger"
                      ? "danger"
                      : meta.tone === "amber"
                        ? "amber"
                        : "default"
                }
              >
                {meta.label}
              </Badge>
            </div>
            <p className="mt-2 whitespace-pre-wrap text-[12px] leading-relaxed text-foreground/85">
              {chapter.summary || "No summary for this chapter yet."}
            </p>
            {!summaryFresh && !summarySkipped && hasContent ? (
              <Button
                size="sm"
                variant="secondary"
                className="mt-3"
                onClick={() => void handleSummarize()}
                disabled={summaryState === "running"}
              >
                {summaryState === "running" ? <Loader2 className="animate-spin" /> : <RefreshCw />}
                {summaryState === "running" ? "Summarizing…" : "Generate summary"}
              </Button>
            ) : null}
          </div>
          <OutlineView
            outline={outline}
            compact
            characterActions={characterActions}
            onDeletePage={(page) => void deletePage(page)}
            deletingPageNumber={deletingPageNumber}
            onSaveSummary={saveChapterSummaryEdit}
          />
          <p className="mt-6 border-t border-border pt-3 text-[10.5px] leading-relaxed text-muted-foreground/70">
            The vault lives in SQLite. Every Planner and Executor call receives this context;
            the manuscript is never sent whole. Summarizer · {modelDisplayId(models.summarizer)}
          </p>
        </div>
      )}
    </div>
  );

  const activeRail = isIllustration ? illustrationRail : planRail;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border px-3 sm:px-5">
        <div className="flex min-w-0 items-center gap-2.5">
          <Button asChild variant="ghost" size="icon-sm" aria-label="Back to book details">
            <Link href={`/novels/${slug}`}>
              <ArrowLeft />
            </Link>
          </Button>
          <div className="min-w-0">
            <p className="truncate text-[12.5px] font-medium text-foreground/90">
              {outline.title}
            </p>
            <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
              Workspace · {pageLabel}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <div className="relative hidden sm:block">
            <select
              value={chapterNumber}
              onChange={(event) => void navigateToChapter(Number(event.target.value))}
              aria-label="Switch chapter"
              className="h-8 appearance-none rounded-[5px] border border-border bg-[#0c1218] pl-2.5 pr-7 text-[11.5px] text-foreground outline-none focus:border-[#5b4a2c] focus:ring-2 focus:ring-ring/30"
            >
              {outline.chapters.map((item) => (
                <option key={item.number} value={item.number}>
                  {item.kind === "illustration"
                    ? `Illustration · page ${item.number}`
                    : `Ch. ${chapterDisplayNumber(item)} · ${item.title}`}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          </div>
          <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
            <Link href={`/novels/${slug}/read?chapter=${chapterNumber}`}>
              <BookOpen />
              Read
            </Link>
          </Button>
          <AddPageMenu slug={slug} />
          <DebugModeToggle compact className="sm:hidden" />
          <DebugModeToggle className="hidden sm:inline-flex" />
          <BookSettingsDialog
            slug={slug}
            onSaved={(next) => setModels(next.models)}
          />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label="Export chapter">
                <Download />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <a
                  href={`/api/novels/${slug}/export?format=md&chapter=${chapterNumber}`}
                  download
                >
                  <FileText />
                  This chapter · Markdown
                </a>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <a
                  href={`/api/novels/${slug}/export?format=docx&chapter=${chapterNumber}`}
                  download
                >
                  <FileText />
                  This chapter · DOCX
                </a>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href={`/novels/${slug}`}>Book details</Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <div className="flex shrink-0 items-center gap-0.5 border-b border-border bg-[#0b1016] p-1 lg:hidden">
        {(
          [
            ["write", isIllustration ? "Illustrate" : "Write"],
            ["plan", isIllustration ? "Info" : "Plan"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setMobileView(value)}
            aria-pressed={mobileView === value}
            className={cn(
              "flex-1 rounded-[4px] px-3 py-1.5 text-[12px] transition-colors",
              mobileView === value
                ? "bg-secondary text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {isDesktop ? (
        <PanelGroup direction="horizontal" autoSaveId={`vibedraft-workspace-${slug}`} className="min-h-0 flex-1">
          <Panel defaultSize={67} minSize={45} className="min-w-0">
            {writePane}
          </Panel>
          <PanelResizeHandle className="w-1 bg-border transition-colors hover:bg-primary/40 data-[resize-handle-state=drag]:bg-primary/70" />
          <Panel defaultSize={33} minSize={26} maxSize={48} className="min-w-0">
            {activeRail}
          </Panel>
        </PanelGroup>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className={cn("min-h-0 flex-1 flex-col", mobileView === "write" ? "flex" : "hidden")}>
            {writePane}
          </div>
          <div className={cn("min-h-0 flex-1 flex-col", mobileView === "plan" ? "flex" : "hidden")}>
            {activeRail}
          </div>
        </div>
      )}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Replace this chapter?</AlertDialogTitle>
            <AlertDialogDescription>
              The Executor will write over the current text. The existing version is kept in
              the chapter history folder, and the new draft starts from the plan on the right.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep the current draft</AlertDialogCancel>
            <AlertDialogAction onClick={() => void startExecution()} disabled={executing}>
              {executing ? "Writing…" : "Execute and replace"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={skipOpen} onOpenChange={setSkipOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Skip this chapter&apos;s summary?</AlertDialogTitle>
            <AlertDialogDescription>
              The next chapter will not receive a summary of what happened here. The manuscript
              stays saved, but the Story Vault will have a gap.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep trying</AlertDialogCancel>
            <AlertDialogAction onClick={() => void skipSummary()} disabled={skipping}>
              {skipping ? "Skipping…" : "Skip summary"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={chapterTitleOpen} onOpenChange={setChapterTitleOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Chapter title</DialogTitle>
            <DialogDescription>
              Generate a title from the last Planner response, or write one yourself.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="chapter-title">Title</Label>
            <div className="flex items-center gap-2">
              <Input
                id="chapter-title"
                value={chapterTitleDraft}
                onChange={(event) => setChapterTitleDraft(event.target.value)}
                maxLength={200}
                placeholder="Untitled Chapter"
              />
              <Button
                type="button"
                variant="secondary"
                onClick={() => void generateChapterTitle()}
                disabled={generatingChapterTitle}
              >
                {generatingChapterTitle ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <Wand2 />
                )}
                Generate Title
              </Button>
            </div>
            {chapterTitleError ? (
              <p className="rounded-md border border-[#5a2c25] bg-[#241411] p-2.5 text-[11.5px] leading-relaxed text-[#f2937f]">
                {chapterTitleError}
              </p>
            ) : null}
          </div>
          <DialogFooter>
            <Button
              variant="secondary"
              onClick={() => setChapterTitleOpen(false)}
              disabled={savingChapterTitle}
            >
              Cancel
            </Button>
            <Button
              onClick={() => void saveChapterTitle()}
              disabled={savingChapterTitle || !chapterTitleDraft.trim()}
            >
              {savingChapterTitle ? <Loader2 className="animate-spin" /> : null}
              {savingChapterTitle ? "Saving…" : "Save title"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {characterEditorOpen ? (
        <CharacterEditorDialog
          open
          onOpenChange={setCharacterEditorOpen}
          initial={outline.characters}
          saving={savingCharacters}
          onSave={(next) => void saveCharacters(next)}
        />
      ) : null}
    </div>
  );
}

function Banner({
  tone,
  icon,
  title,
  body,
  actions,
}: {
  tone: "amber" | "danger" | "muted";
  icon: React.ReactNode;
  title: string;
  body: string;
  actions?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "mb-3 flex flex-wrap items-start justify-between gap-3 rounded-md border p-3",
        tone === "danger"
          ? "border-[#5a2c25] bg-[#241411]"
          : tone === "amber"
            ? "border-[#5b431c] bg-[#1b1409]"
            : "border-border bg-[#0d131a]",
      )}
    >
      <div className="flex min-w-0 flex-1 items-start gap-2.5">
        <span
          className={cn(
            "mt-0.5 shrink-0",
            tone === "danger" ? "text-[#f2937f]" : tone === "amber" ? "text-[#f2c477]" : "text-muted-foreground",
          )}
        >
          {icon}
        </span>
        <div className="min-w-0">
          <p
            className={cn(
              "text-[12.5px] font-medium",
              tone === "danger" ? "text-[#f2937f]" : tone === "amber" ? "text-[#f2c477]" : "text-foreground",
            )}
          >
            {title}
          </p>
          <p className="mt-0.5 text-[11.5px] leading-relaxed text-muted-foreground">{body}</p>
        </div>
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
