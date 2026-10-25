"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  readingPageWidth,
  readingPaperStyle,
  type ReadingPreferences,
} from "@/lib/reading-preferences";
import { chapterDisplayTitle, pageKindLabel } from "@/lib/pages";
import type { Chapter, Outline } from "@/lib/schemas";

const COLUMN_GAP = 56;

export function PaginatedReader({
  chapter,
  content,
  outline,
  preferences,
  initialPage = 0,
  onPageChange,
  hasPreviousChapter,
  hasNextChapter,
  onPreviousChapter,
  onNextChapter,
}: {
  chapter: Chapter;
  content: string;
  outline: Outline;
  preferences: ReadingPreferences;
  initialPage?: number;
  onPageChange?: (page: number) => void;
  hasPreviousChapter: boolean;
  hasNextChapter: boolean;
  onPreviousChapter: () => void;
  onNextChapter: () => void;
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef<number | null>(null);
  const [pageWidth, setPageWidth] = useState(0);
  const [pageCount, setPageCount] = useState(1);
  const [page, setPage] = useState(Math.max(0, initialPage));

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const update = () => setPageWidth(Math.max(1, Math.floor(viewport.clientWidth)));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [chapter.number, preferences.fontFamily, preferences.fontSize, preferences.pageWidth]);

  useEffect(() => {
    const element = contentRef.current;
    if (!element || !pageWidth) return;
    const update = () => {
      const nextCount = Math.max(
        1,
        Math.ceil((element.scrollWidth + COLUMN_GAP) / (pageWidth + COLUMN_GAP)),
      );
      setPageCount(nextCount);
      setPage((current) => Math.min(current, nextCount - 1));
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, [content, pageWidth, chapter.number, preferences.fontFamily, preferences.fontSize]);

  useEffect(() => {
    onPageChange?.(page);
  }, [onPageChange, page]);

  const previousPage = useCallback(() => {
    if (page > 0) {
      setPage((current) => current - 1);
      return;
    }
    if (hasPreviousChapter) onPreviousChapter();
  }, [hasPreviousChapter, onPreviousChapter, page]);

  const nextPage = useCallback(() => {
    if (page < pageCount - 1) {
      setPage((current) => current + 1);
      return;
    }
    if (hasNextChapter) onNextChapter();
  }, [hasNextChapter, onNextChapter, page, pageCount]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const tag = (event.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        previousPage();
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        nextPage();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [nextPage, previousPage]);

  return (
    <div
      className="mx-auto flex h-full min-h-0 w-full flex-col px-4 py-4 sm:px-8 sm:py-6"
      style={{ maxWidth: readingPageWidth(preferences) }}
    >
      <div
        className="paper-sheet relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-[4px] px-6 py-8 sm:px-12 sm:py-12"
        style={readingPaperStyle(preferences)}
      >
        <div
          ref={viewportRef}
          className="min-h-0 flex-1 overflow-hidden"
          onTouchStart={(event) => {
            touchStartX.current = event.touches[0]?.clientX ?? null;
          }}
          onTouchEnd={(event) => {
            if (touchStartX.current === null) return;
            const delta = (event.changedTouches[0]?.clientX ?? 0) - touchStartX.current;
            touchStartX.current = null;
            if (Math.abs(delta) < 50) return;
            if (delta < 0) nextPage();
            else previousPage();
          }}
        >
          {pageWidth ? (
            <div
              ref={contentRef}
              className="h-full transition-transform duration-200 ease-out"
              style={{
                width: `${pageWidth}px`,
                columnWidth: `${pageWidth}px`,
                columnGap: `${COLUMN_GAP}px`,
                columnFill: "auto",
                transform: `translateX(-${page * (pageWidth + COLUMN_GAP)}px)`,
              }}
            >
              <div className="flex items-center gap-2">
                <span className="paper-kicker font-mono text-[9px] uppercase tracking-[0.18em]">
                  {pageKindLabel(chapter)}
                </span>
                <span className="h-px w-6 bg-[var(--page-line)]" />
                <span className="paper-kicker font-mono text-[9px] uppercase tracking-[0.14em]">
                  {outline.title}
                </span>
              </div>
              <h1 className="paper-title mt-3 text-[2.1rem] leading-[1.08] tracking-[-0.02em] sm:text-[2.5rem]">
                {chapterDisplayTitle(chapter)}
              </h1>
              <div className="paper-rule mt-2 h-px w-12" />
              <div className="manuscript mt-8">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        <Button
          variant="secondary"
          size="sm"
          onClick={previousPage}
          disabled={page === 0 && !hasPreviousChapter}
        >
          <ChevronLeft />
          {page === 0 && hasPreviousChapter ? "Previous chapter" : "Previous page"}
        </Button>
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
          Page {page + 1} of {pageCount}
        </span>
        <Button
          variant="secondary"
          size="sm"
          onClick={nextPage}
          disabled={page === pageCount - 1 && !hasNextChapter}
        >
          {page === pageCount - 1 && hasNextChapter ? "Next chapter" : "Next page"}
          <ChevronRight />
        </Button>
      </div>
    </div>
  );
}
