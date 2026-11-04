"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
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
import { useDebugStore, type DebugPayloadRequest } from "@/lib/debug-store";

const CodeEditor = dynamic(
  () => import("@uiw/react-textarea-code-editor").then((mod) => mod.default),
  {
    ssr: false,
    loading: () => (
      <div className="p-3 font-mono text-[11.5px] text-muted-foreground">Loading editor…</div>
    ),
  },
);

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

      <div className="max-h-[55vh] overflow-y-auto rounded-md border border-input bg-[#070b10]">
        <CodeEditor
          value={draft}
          language="json"
          onChange={(event) => {
            setDraft(event.target.value);
            if (error) setError(null);
          }}
          padding={12}
          minHeight={240}
          id="debug-payload-json"
          aria-label="Outgoing API payload JSON"
          spellCheck={false}
          data-color-mode="dark"
          style={{
            fontFamily:
              'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
            fontSize: 11.5,
            lineHeight: 1.6,
          }}
        />
      </div>

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