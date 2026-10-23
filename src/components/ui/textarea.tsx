import * as React from "react";
import { cn } from "@/lib/utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex min-h-20 w-full resize-none rounded-md border border-input bg-[#0c1218] px-3 py-2 text-sm text-foreground shadow-[0_1px_0_rgba(255,255,255,0.03)_inset] transition-colors duration-150 placeholder:text-muted-foreground focus-visible:border-[#5b4a2c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
