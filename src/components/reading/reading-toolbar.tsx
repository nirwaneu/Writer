"use client";

import { Minus, Moon, Plus, Sun } from "lucide-react";
import { Select } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  MAX_READING_SIZE,
  MIN_READING_SIZE,
  PAGE_WIDTHS,
  READING_FONTS,
  type ReadingPreferences,
} from "@/lib/reading-preferences";
import { cn } from "@/lib/utils";

export function ReadingToolbar({
  preferences,
  onChange,
  className,
}: {
  preferences: ReadingPreferences;
  onChange: (patch: Partial<ReadingPreferences>) => void;
  className?: string;
}) {
  const dark = preferences.theme === "dark";

  return (
    <div
      className={cn(
        "inline-flex max-w-full flex-wrap items-center gap-1 rounded-md border border-border bg-[#0c1218] p-0.5",
        className,
      )}
      aria-label="Reading comfort"
    >
      <div className="flex items-center gap-0.5 rounded-[4px] bg-[#0b1016] p-0.5">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => onChange({ theme: "light" })}
              aria-pressed={!dark}
              aria-label="Light page"
              className={cn(
                "flex size-6 items-center justify-center rounded-[3px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                !dark
                  ? "bg-secondary text-[#f2c477]"
                  : "text-muted-foreground hover:bg-white/5 hover:text-foreground",
              )}
            >
              <Sun className="size-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top">Light page</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => onChange({ theme: "dark" })}
              aria-pressed={dark}
              aria-label="Dark page"
              className={cn(
                "flex size-6 items-center justify-center rounded-[3px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                dark
                  ? "bg-secondary text-[#f2c477]"
                  : "text-muted-foreground hover:bg-white/5 hover:text-foreground",
              )}
            >
              <Moon className="size-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top">Dark page</TooltipContent>
        </Tooltip>
      </div>

      <span className="mx-0.5 h-4 w-px bg-border" aria-hidden="true" />

      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={() => onChange({ fontSize: preferences.fontSize - 1 })}
            disabled={preferences.fontSize <= MIN_READING_SIZE}
            aria-label="Decrease text size"
            className="flex size-6 items-center justify-center rounded-[3px] text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground disabled:opacity-35"
          >
            <Minus className="size-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top">Smaller text</TooltipContent>
      </Tooltip>
      <span className="w-5 text-center font-mono text-[9px] tabular text-muted-foreground">
        {preferences.fontSize}
      </span>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={() => onChange({ fontSize: preferences.fontSize + 1 })}
            disabled={preferences.fontSize >= MAX_READING_SIZE}
            aria-label="Increase text size"
            className="flex size-6 items-center justify-center rounded-[3px] text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground disabled:opacity-35"
          >
            <Plus className="size-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top">Larger text</TooltipContent>
      </Tooltip>

      <span className="mx-0.5 h-4 w-px bg-border" aria-hidden="true" />

      <Select
        aria-label="Reading typeface"
        value={preferences.fontFamily}
        onChange={(event) =>
          onChange({
            fontFamily: event.target.value as ReadingPreferences["fontFamily"],
          })
        }
        className="h-7 w-[132px] border-0 bg-[#0b1016] text-[11px] focus:ring-0"
      >
        {READING_FONTS.map((font) => (
          <option key={font.id} value={font.id}>
            {font.label}
          </option>
        ))}
      </Select>

      <span className="mx-0.5 h-4 w-px bg-border" aria-hidden="true" />

      <Select
        aria-label="Page width"
        title="Page width"
        value={preferences.pageWidth}
        onChange={(event) =>
          onChange({
            pageWidth: event.target.value as ReadingPreferences["pageWidth"],
          })
        }
        className="h-7 w-[94px] border-0 bg-[#0b1016] text-[11px] focus:ring-0"
      >
        {PAGE_WIDTHS.map((width) => (
          <option key={width.id} value={width.id}>
            {width.label}
          </option>
        ))}
      </Select>
    </div>
  );
}
