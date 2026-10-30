"use client";

import { Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useDebugStore } from "@/lib/debug-store";

export function DebugPayloadDialog() {
  const request = useDebugStore((state) => state.request);
  const resolve = useDebugStore((state) => state.resolve);

  async function copyPayload() {
    if (!request) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(request.payload, null, 2));
      toast.success("Payload copied.");
    } catch {
      toast.error("Could not copy the payload.");
    }
  }

  return (
    <Dialog
      open={Boolean(request)}
      onOpenChange={(open) => {
        if (!open) resolve(false);
      }}
    >
      <DialogContent className="max-w-3xl" showClose>
        <DialogHeader>
          <DialogTitle>Debug Mode · outgoing payload</DialogTitle>
          <DialogDescription>
            This is the exact JSON body that will be sent to the model provider. Review it, then
            send or cancel. Request route:{" "}
            <span className="font-mono text-foreground/80">{request?.endpoint ?? "unknown"}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[55vh] overflow-auto rounded-md border border-border bg-[#070b10]">
          <pre className="min-w-full p-4 font-mono text-[11.5px] leading-relaxed text-foreground/85">
            <code>{request ? JSON.stringify(request.payload, null, 2) : ""}</code>
          </pre>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={copyPayload} disabled={!request}>
            <Copy />
            Copy JSON
          </Button>
          <Button variant="secondary" onClick={() => resolve(false)}>
            Cancel
          </Button>
          <Button onClick={() => resolve(true)}>Send Request</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
