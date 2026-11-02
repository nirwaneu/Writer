"use client";

import { useState, type CSSProperties } from "react";
import { cn } from "@/lib/utils";

export function ExpandableText({
  text,
  empty,
  lines = 4,
  className,
  textClassName,
  buttonClassName,
}: {
  text: string;
  empty?: string;
  lines?: number;
  className?: string;
  textClassName?: string;
  buttonClassName?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const value = text.trim() || empty || "";
  const isLong = value.length > 280 || value.split(/\r?\n/).length > 4;

  const clampStyle: CSSProperties | undefined =
    !expanded && isLong
      ? {
          display: "-webkit-box",
          WebkitBoxOrient: "vertical",
          WebkitLineClamp: lines,
          overflow: "hidden",
        }
      : undefined;

  return (
    <div className={className}>
      <p className={cn("whitespace-pre-wrap", textClassName)} style={clampStyle}>
        {value}
      </p>
      {isLong ? (
        <button
          type="button"
          onClick={() => setExpanded((current) => !current)}
          aria-expanded={expanded}
          className={cn(
            "mt-1.5 text-[11px] font-medium text-[#f2c477] underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            buttonClassName,
          )}
        >
          {expanded ? "Show Less" : "Read More"}
        </button>
      ) : null}
    </div>
  );
}