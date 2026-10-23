"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  Download,
  FileText,
  ListTree,
  PencilLine,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { OutlineView } from "@/components/outline/outline-view";
import { ReadingToolbar } from "@/components/reading/reading-toolbar";
import {
  readingPageWidth,
  readingPaperStyle,
  useReadingPreferences,
} from "@/lib/reading-preferences";
import { cn, readingTime } from "@/lib/utils";
import type { Outline } from "@/lib/schemas";

const numberFormat = new Intl.NumberFormat("en");

export function ReaderView({
  slug,
  outline,
  contents,
  initialChapter,
}: {
  slug: string;
  outline: Outline;
  contents: Record<number, string>;
  initialChapter: number;
}) {
  const router = useRouter();
  const [current, setCurrent] = useState(initialChapter);
  const [outlineOpen, setOutlineOpen] = useState(false);
  const reading = useReadingPreferences();

  const chapter = outline.chapters.find((item) => item.number === current) ?? outline.chapters[0];
  const index = outline.chapters.findIndex((item) => item.number === chapter?.number);
  const content = contents[chapter?.number ?? 0] ?? "";
  const previous = index > 0 ? outline.chapters[index - 1] : null;
  const next = index >= 0 && index < outline.chapters.length - 1 ? outline.chapters[index + 1] : null;

  const progress = useMemo(() => {
    if (!outline.chapters.length) return 0;
    return ((index + 1) / outline.chapters.length) * 100;
  }, [index, outline.chapters.length]);

  function goTo(number: number) {
    const target = outline.chapters.find((item) => item.number === number);
    if (!target) return;
    setCurrent(number);
    router.replace(`/novels/${slug}/read?chapter=${number}`, { scroll: false });
    window.scrollTo({ top: 0, behavior: "auto" });
    document.getElementById("reader-scroll")?.scrollTo({ top: 0, behavior: "auto" });
  }

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const tag = (event.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (event.key === "ArrowLeft" && previous) {
        event.preventDefault();
        goTo(previous.number);
      }
      if (event.key === "ArrowRight" && next) {
        event.preventDefault();
        goTo(next.number);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (!chapter) {
    return (
      <div className="flex h-full items-center justify-center text-[13px] text-muted-foreground">
        This book has no chapters yet.
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="h-0.5 shrink-0 bg-[#18212b]">
        <div
          className="h-full bg-primary/80 transition-[width] duration-200 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>
      <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border bg-[#0b0f14] px-3 sm:px-5">
        <div className="flex min-w-0 items-center gap-2">
          <Button asChild variant="ghost" size="icon-sm" aria-label="Back to book details">
            <Link href={`/novels/${slug}`}>
              <ArrowLeft />
            </Link>
          </Button>
          <div className="min-w-0">
            <p className="truncate text-[12.5px] font-medium text-foreground/90">{outline.title}</p>
            <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
              Reading mode
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <div className="relative hidden sm:block">
            <select
              value={chapter.number}
              onChange={(event) => goTo(Number(event.target.value))}
              aria-label="Choose a chapter"
              className="h-8 appearance-none rounded-[5px] border border-border bg-[#0c1218] pl-2.5 pr-7 text-[11.5px] text-foreground outline-none focus:border-[#5b4a2c] focus:ring-2 focus:ring-ring/30"
            >
              {outline.chapters.map((item) => (
                <option key={item.number} value={item.number}>
                  Chapter {item.number} — {item.title}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          </div>

          <Dialog open={outlineOpen} onOpenChange={setOutlineOpen}>
            <DialogTrigger asChild>
              <Button variant="secondary" size="sm">
                <ListTree />
                <span className="hidden sm:inline">View outline</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Story Vault</DialogTitle>
              </DialogHeader>
              <div className="max-h-[70vh] overflow-y-auto pr-1">
                <OutlineView outline={outline} compact />
              </div>
            </DialogContent>
          </Dialog>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label="Export">
                <Download />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <a href={`/api/novels/${slug}/export?format=md&chapter=${chapter.number}`} download>
                  <FileText />
                  This chapter · Markdown
                </a>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <a href={`/api/novels/${slug}/export?format=docx&chapter=${chapter.number}`} download>
                  <FileText />
                  This chapter · DOCX
                </a>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <a href={`/api/novels/${slug}/export?format=md`} download>
                  <Download />
                  Whole book · Markdown
                </a>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <a href={`/api/novels/${slug}/export?format=docx`} download>
                  <Download />
                  Whole book · DOCX
                </a>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <a href={`/api/novels/${slug}/export?format=html`} download>
                  <Download />
                  Whole book · HTML
                </a>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
            <Link href={`/novels/${slug}/write?chapter=${chapter.number}`}>
              <PencilLine />
              Edit
            </Link>
          </Button>
        </div>
      </header>

      <div className="flex shrink-0 items-center justify-end gap-2 border-b border-border bg-[#0b0f14] px-3 py-1.5 sm:justify-between sm:px-5">
        <span className="hidden font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground sm:inline">
          Reading comfort
        </span>
        <ReadingToolbar preferences={reading.preferences} onChange={reading.update} />
      </div>

      <div id="reader-scroll" className="min-h-0 flex-1 overflow-y-auto">
        <div
          className="mx-auto w-full px-4 py-8 sm:px-8 sm:py-12"
          style={{ maxWidth: readingPageWidth(reading.preferences) }}
        >
          <article
            className={cn(
              "paper-sheet relative rounded-[4px] px-6 py-9 sm:px-14 sm:py-14",
              reading.preferences.theme === "dark" && "paper-dark",
            )}
            style={readingPaperStyle(reading.preferences)}
          >
            <div className="flex items-center gap-2">
              <span className="paper-kicker font-mono text-[9px] uppercase tracking-[0.18em]">
                Chapter {chapter.number}
              </span>
              <span className="h-px w-6 bg-[var(--page-line)]" />
              <span className="paper-kicker font-mono text-[9px] uppercase tracking-[0.14em]">
                {numberFormat.format(chapter.wordCount)} words · {readingTime(chapter.wordCount)}
              </span>
            </div>
            <h1 className="paper-title mt-3 text-[2.1rem] leading-[1.08] tracking-[-0.02em] sm:text-[2.5rem]">
              {chapter.title}
            </h1>
            <div className="paper-rule mt-2 h-px w-12" />

            {content ? (
              <div className="manuscript mt-8">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
              </div>
            ) : (
              <div className="mt-10 border-t border-[var(--page-line)] pt-6">
                <p className="paper-soft font-serif text-[1.1rem] italic">
                  This chapter has not been drafted yet.
                </p>
                <Link
                  href={`/novels/${slug}/write?chapter=${chapter.number}`}
                  className="mt-3 inline-flex items-center gap-1.5 text-[12px] text-[var(--page-accent)] underline underline-offset-4"
                >
                  Open the workspace
                  <ArrowRight className="size-3.5" />
                </Link>
              </div>
            )}

            <div className="mt-12 flex items-center justify-between gap-4 border-t border-[var(--page-line)] pt-5">
              <div className="paper-kicker font-mono text-[9px] uppercase tracking-[0.16em]">
                {outline.title}
              </div>
              <div className="paper-kicker font-mono text-[9px] tabular">
                {index + 1} / {outline.chapters.length}
              </div>
            </div>
          </article>

          <nav className="mt-5 flex items-center justify-between gap-3">
            <Button
              variant="secondary"
              onClick={() => previous && goTo(previous.number)}
              disabled={!previous}
              className="max-w-[45%]"
            >
              <ArrowLeft />
              <span className="truncate">
                {previous ? `Ch. ${previous.number}` : "Start"}
              </span>
            </Button>
            <Button
              variant="secondary"
              onClick={() => next && goTo(next.number)}
              disabled={!next}
              className="max-w-[45%]"
            >
              <span className="truncate">{next ? `Ch. ${next.number}` : "End"}</span>
              <ArrowRight />
            </Button>
          </nav>
          <p className="mt-3 text-center font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground/80">
            ← → to turn the page
          </p>
        </div>
      </div>
    </div>
  );
}
