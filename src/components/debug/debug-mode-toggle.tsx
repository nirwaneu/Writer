"use client";

import { Bug } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useDebugMode } from "@/lib/use-debug-mode";

export function DebugModeToggle({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  const { enabled, toggle } = useDebugMode();
  return (
    <Button
      type="button"
      variant={enabled ? "secondary" : "ghost"}
      size={compact ? "icon-sm" : "sm"}
      onClick={toggle}
      aria-pressed={enabled}
      aria-label="Toggle Debug Mode"
      title={enabled ? "Debug Mode is on" : "Debug Mode is off"}
      className={cn("gap-2", className)}
    >
      <Bug className={cn("size-3.5", enabled && "text-[#f2c477]")} />
      {compact ? null : (
        <>
          <span className="text-[11px]">Debug Mode</span>
          <span
            className={cn(
              "relative inline-flex h-3.5 w-6 items-center rounded-full border border-border transition-colors",
              enabled ? "bg-[#f2a93b]/80" : "bg-[#1a222c]",
            )}
          >
            <span
              className={cn(
                "absolute size-2.5 rounded-full bg-[#0b1016] transition-transform",
                enabled ? "translate-x-3" : "translate-x-0.5",
              )}
            />
          </span>
        </>
      )}
    </Button>
  );
}
