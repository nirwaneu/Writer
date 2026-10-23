"use client";

import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <TooltipProvider delayDuration={350} skipDelayDuration={100}>
      {children}
      <Toaster
        theme="dark"
        position="bottom-left"
        offset={16}
        closeButton
        toastOptions={{
          style: {
            background: "#151d27",
            border: "1px solid #26313d",
            color: "#e9e2d4",
            borderRadius: "6px",
            fontSize: "13px",
          },
        }}
      />
    </TooltipProvider>
  );
}
