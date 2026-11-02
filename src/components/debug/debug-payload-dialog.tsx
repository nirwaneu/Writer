"use client";

import { useState } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { useDebugStore, type DebugPayloadRequest } from "@/lib/debug-store";

export function DebugPayloadDialog() {
  const request = useDebugStore((state) => state.request);
  const resolve = useDebugStore((state) => state.resolve);

  return (
    <Dialog
      open={Boolean(request)}
      onOpenChange={(open) => {
        if (!open) resolve(null);
      }}
    >
      <DialogContent className="max-w-3xl" showClose>
        {request ? (
          <DebugPayloadForm key={request.id} request={request} onResolve={resolve} />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function DebugPayloadForm({
  request,
  onResolve,
}: {
  request: DebugPayloadRequest;
  onResolve: (payload: Record<string, unknown> | null) => void;
}) {
  const [draft, setDraft] = useState(() => JSON.stringify(request.payload, null, 2));
  const [error, setError] = useState<string | null>(null);

  function formatDraft() {
    try {
      const parsed: unknown = JSON.parse(draft);
      setDraft(JSON.stringify(parsed, null, 2));
      setError(null);
    } catch (caught) {
      setError(`Invalid JSON: ${(caught as Error).message}`);
    }
  }

  async function copyDraft() {
    try {
      await navigator.clipboard.writeText(draft);
      toast.success("Payload copied.");
    } catch {
      toast.error("Could not copy the payload.");
    }
  }

  function send() {
    let parsed: unknown;
    try {
      parsed = JSON.parse(draft);
    } catch (caught) {
      setError(`Invalid JSON: ${(caught as Error).message}`);
      return;
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      setError("The payload must be a JSON object.");
      return;
    }
    onResolve(parsed as Record<string, unknown>);
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Debug Mode · outgoing payload</DialogTitle>
        <DialogDescription>
          This is the exact JSON body that will be sent to the model provider. Edit it if needed,
          then send or cancel. Request route:{" "}
          <span className="font-mono text-foreground/80">{request.endpoint}</span>
        </DialogDescription>
      </DialogHeader>

      <Textarea
        value={draft}
        onChange={(event) => {
          setDraft(event.target.value);
          if (error) setError(null);
        }}
        spellCheck={false}
        aria-label="Outgoing API payload JSON"
        className="min-h-[240px] max-h-[55vh] resize-y overflow-y-auto font-mono text-[11.5px] leading-relaxed"
      />

      <p
        className={
          error
            ? "text-[11px] leading-relaxed text-[#f2937f]"
            : "text-[10.5px] leading-relaxed text-muted-foreground"
        }
      >
        {error || "Edits are sent as-is. Invalid JSON blocks the request."}
      </p>

      <DialogFooter>
        <Button variant="ghost" onClick={() => void copyDraft()}>
          <Copy />
          Copy JSON
        </Button>
        <Button variant="ghost" onClick={formatDraft}>
          Format
        </Button>
        <Button variant="secondary" onClick={() => onResolve(null)}>
          Cancel
        </Button>
        <Button onClick={send}>Send Request</Button>
      </DialogFooter>
    </>
  );
}