"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2, SlidersHorizontal, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { createDraftRequest } from "@/lib/client/drafts";
import type { ModelRoles, Preset, Provider } from "@/lib/schemas";
import { modelDisplayLabel } from "@/lib/ai/routing";

export function NewBookDialog({
  open,
  onOpenChange,
  presets,
  defaultPresetId,
  globalModels,
  providers,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  presets: Preset[];
  defaultPresetId: string;
  globalModels: ModelRoles | null;
  providers: Array<Pick<Provider, "id" | "name">>;
}) {
  const router = useRouter();
  const [presetId, setPresetId] = useState(defaultPresetId);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);


  const selected = presets.find((preset) => preset.id === presetId) ?? presets[0];

  async function create() {
    if (!selected) return;
    setCreating(true);
    setError(null);
    try {
      const id = await createDraftRequest(selected.id);
      router.push(`/new?draft=${id}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not start a new book.");
      setCreating(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Start a new book</DialogTitle>
          <DialogDescription>
            Choose the preset this book starts from. Its prompts, parameters, and the current
            global models are copied into the book folder. Later changes here do not affect it.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="new-book-preset">AI preset</Label>
            <Select
              id="new-book-preset"
              value={presetId}
              onChange={(event) => setPresetId(event.target.value)}
            >
              {presets.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.name}
                  {preset.id === defaultPresetId ? " · default" : ""}
                </option>
              ))}
            </Select>
            {selected ? (
              <p className="text-[11.5px] leading-relaxed text-muted-foreground">
                {selected.description || "No description."}
              </p>
            ) : null}
          </div>

          <div className="rounded-md border border-border bg-[#0c1218] p-3">
            <div className="flex items-center gap-2 text-[11px] font-medium text-foreground/90">
              <Sparkles className="size-3.5 text-primary" />
              Copied into this book
            </div>
            <div className="mt-2 grid gap-1.5 text-[11px] text-muted-foreground">
              <span>
                <span className="text-foreground/80">Planner:</span>{" "}
                {globalModels?.planner
                  ? modelDisplayLabel(providers, globalModels.planner)
                  : "not set"}
              </span>
              <span>
                <span className="text-foreground/80">Executor:</span>{" "}
                {globalModels?.executor
                  ? modelDisplayLabel(providers, globalModels.executor)
                  : "not set"}
              </span>
              <span>
                <span className="text-foreground/80">Summarizer:</span>{" "}
                {globalModels?.summarizer
                  ? modelDisplayLabel(providers, globalModels.summarizer)
                  : "not set"}
              </span>
            </div>
            <p className="mt-2 border-t border-border pt-2 text-[10.5px] leading-relaxed text-muted-foreground">
              The book gets its own settings row in <span className="font-mono">vibedraft.db</span>.
            </p>
          </div>

          {error ? (
            <p className="rounded-md border border-[#5a2c25] bg-[#241411] p-3 text-[12px] text-[#f2937f]">
              {error}
            </p>
          ) : null}
        </div>

        <DialogFooter className="items-center sm:justify-between">
          <Link
            href="/presets"
            className="inline-flex items-center gap-1.5 text-[11.5px] text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            <SlidersHorizontal className="size-3.5" />
            Manage presets
          </Link>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={creating}>
              Cancel
            </Button>
            <Button onClick={() => void create()} disabled={creating || !selected}>
              {creating ? <Loader2 className="animate-spin" /> : <ArrowRight />}
              {creating ? "Opening a page…" : "Start brainstorming"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
