"use client";

import { useCallback, useEffect, useState, type CSSProperties } from "react";

export const READING_FONTS = [
  {
    id: "literary",
    label: "Literary serif",
    stack:
      '"Iowan Old Style", "Palatino Linotype", Palatino, "Book Antiqua", Georgia, serif',
  },
  {
    id: "charter",
    label: "Charter",
    stack: '"Charter", "Bitstream Charter", "Sitka Text", Georgia, serif',
  },
  {
    id: "garamond",
    label: "Garamond",
    stack:
      '"EB Garamond", "Adobe Garamond Pro", Garamond, "Apple Garamond", Georgia, serif',
  },
  {
    id: "georgia",
    label: "Georgia",
    stack: 'Georgia, "Times New Roman", serif',
  },
  {
    id: "humanist",
    label: "Humanist sans",
    stack: '"Segoe UI", "Helvetica Neue", Arial, sans-serif',
  },
] as const;

export const PAGE_WIDTHS = [
  { id: "standard", label: "Standard", maxWidth: "820px" },
  { id: "cozy", label: "Cozy", maxWidth: "620px" },
  { id: "wide", label: "Wide", maxWidth: "1040px" },
  { id: "full", label: "Full", maxWidth: "100%" },
] as const;

export type ReadingFontId = (typeof READING_FONTS)[number]["id"];
export type ReadingTheme = "light" | "dark";
export type ReadingPageWidth = (typeof PAGE_WIDTHS)[number]["id"];

export type ReadingPreferences = {
  theme: ReadingTheme;
  fontSize: number;
  fontFamily: ReadingFontId;
  pageWidth: ReadingPageWidth;
};

export const MIN_READING_SIZE = 12;
export const MAX_READING_SIZE = 24;

export const DEFAULT_READING_PREFERENCES: ReadingPreferences = {
  theme: "light",
  fontSize: 19,
  fontFamily: "literary",
  pageWidth: "standard",
};

const STORAGE_KEY = "vibedraft:reading-preferences";

export function getReadingFontStack(id: ReadingFontId): string {
  return READING_FONTS.find((font) => font.id === id)?.stack ?? READING_FONTS[0].stack;
}

function sanitize(value: unknown): ReadingPreferences {
  if (!value || typeof value !== "object") return DEFAULT_READING_PREFERENCES;
  const input = value as Partial<ReadingPreferences>;
  const theme: ReadingTheme = input.theme === "dark" ? "dark" : "light";
  const rawSize = Number(input.fontSize);
  const fontSize = Number.isFinite(rawSize)
    ? Math.min(MAX_READING_SIZE, Math.max(MIN_READING_SIZE, Math.round(rawSize)))
    : DEFAULT_READING_PREFERENCES.fontSize;
  const fontFamily = READING_FONTS.some((font) => font.id === input.fontFamily)
    ? (input.fontFamily as ReadingFontId)
    : DEFAULT_READING_PREFERENCES.fontFamily;
  const pageWidth = PAGE_WIDTHS.some((width) => width.id === input.pageWidth)
    ? (input.pageWidth as ReadingPageWidth)
    : DEFAULT_READING_PREFERENCES.pageWidth;
  return { theme, fontSize, fontFamily, pageWidth };
}

export function useReadingPreferences() {
  const [preferences, setPreferences] = useState<ReadingPreferences>(
    DEFAULT_READING_PREFERENCES,
  );

  useEffect(() => {
    let cancelled = false;
    const frame = requestAnimationFrame(() => {
      if (cancelled) return;
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (raw) setPreferences(sanitize(JSON.parse(raw)));
      } catch {
        // localStorage can be unavailable in private or blocked contexts.
      }
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
    };
  }, []);

  const update = useCallback((patch: Partial<ReadingPreferences>) => {
    setPreferences((current) => {
      const next = sanitize({ ...current, ...patch });
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Preferences remain in memory if storage is unavailable.
      }
      return next;
    });
  }, []);

  return { preferences, update };
}

export function readingPageWidth(preferences: ReadingPreferences): string {
  return (
    PAGE_WIDTHS.find((width) => width.id === preferences.pageWidth)?.maxWidth ??
    PAGE_WIDTHS[0].maxWidth
  );
}

export function readingPaperStyle(preferences: ReadingPreferences): CSSProperties {
  return {
    "--manuscript-size": `${preferences.fontSize}px`,
    "--manuscript-font": getReadingFontStack(preferences.fontFamily),
  } as CSSProperties;
}
