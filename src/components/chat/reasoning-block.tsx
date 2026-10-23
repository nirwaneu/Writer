"use client";

import { ChevronRight } from "lucide-react";

export function ReasoningBlock({
  reasoning,
  streaming = false,
  label = "Reasoning",
}: {
  reasoning: string;
  streaming?: boolean;
  label?: string;
}) {
  if (!reasoning.trim()) return null;
  return (
    <details className="group/reasoning mb-2 rounded-md border border-border/70 bg-white/[0.02]">
      <summary className="flex cursor-pointer list-none items-center gap-1.5 px-2.5 py-1.5 text-[11px] text-muted-foreground [&::-webkit-details-marker]:hidden">
        <ChevronRight className="size-3 transition-transform group-open/reasoning:rotate-90" />
        <span>{label}</span>
        {streaming ? (
          <span className="flex items-center gap-1.5 text-[#c9a86e]">
            <span className="size-1 animate-pulse-dot rounded-full bg-primary" />
            live
          </span>
        ) : null}
      </summary>
      <div className="max-h-64 overflow-y-auto whitespace-pre-wrap border-t border-border/60 px-2.5 py-2 text-[11.5px] leading-relaxed text-muted-foreground">
        {reasoning}
      </div>
    </details>
  );
}
