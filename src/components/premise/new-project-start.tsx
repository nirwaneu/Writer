"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { createDraftRequest } from "@/lib/client/drafts";
import type { Preset } from "@/lib/schemas";

export function NewProjectStart({
  message,
  presets,
  defaultPresetId,
}: {
  message?: string;
  presets: Preset[];
  defaultPresetId: string;
}) {
  const router = useRouter();
  const [presetId, setPresetId] = useState(
    presets.some((preset) => preset.id === defaultPresetId)
      ? defaultPresetId
      : presets[0]?.id ?? "",
  );
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selected = presets.find((preset) => preset.id === presetId) ?? presets[0];

  async function create() {
    if (!selected) return;
    setCreating(true);
    setError(null);
    try {
      const id = await createDraftRequest(selected.id);
      router.replace(`/new?draft=${id}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not open a new draft.");
      setCreating(false);
    }
  }

  return (
    <div className="flex h-full items-center justify-center overflow-y-auto px-5 py-10">
      <div className="grid w-full max-w-3xl gap-8 rounded-lg border border-border bg-[#0d131a] p-7 md:grid-cols-[1fr_240px] md:p-10">
        <div>
          <Button asChild variant="ghost" size="sm" className="-ml-2 mb-5">
            <Link href="/">
              <ArrowLeft />
              Library
            </Link>
          </Button>
          <h1 className="font-serif text-[2.2rem] leading-[1.05] tracking-[-0.025em]">
            A new book starts as a conversation.
          </h1>
          <p className="mt-3 max-w-md text-[13px] leading-relaxed text-muted-foreground">
            Choose the preset this book copies, then talk the idea through with the Planner. The
            premise and the name come out of that conversation.
          </p>

          <div className="mt-5 max-w-sm space-y-1.5">
            <Label htmlFor="start-preset">AI preset</Label>
            <Select
              id="start-preset"
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
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                {selected.description || "No description."}
              </p>
            ) : null}
          </div>

          {message ? (
            <p className="mt-4 rounded-md border border-[#5a2c25] bg-[#241411] p-3 text-[12px] text-[#f2937f]">
              {message}
            </p>
          ) : null}
          {error ? (
            <p className="mt-4 rounded-md border border-[#5a2c25] bg-[#241411] p-3 text-[12px] text-[#f2937f]">
              {error}
            </p>
          ) : null}

          <div className="mt-6">
            <Button onClick={() => void create()} disabled={creating || !selected}>
              {creating ? <Loader2 className="animate-spin" /> : <Plus />}
              {creating ? "Opening a page…" : "Start brainstorming"}
            </Button>
          </div>
        </div>
        <div className="hidden items-center justify-center border-l border-border pl-8 md:flex">
          <div className="paper-sheet w-full max-w-[190px] rounded-[3px] p-5">
            <p className="font-mono text-[7px] uppercase tracking-[0.22em] text-[#8a7c66]">
              Untitled
            </p>
            <div className="mt-3 h-px w-8 bg-[#a86412]" />
            <div className="mt-5 space-y-2" aria-hidden="true">
              {[92, 100, 74, 96, 86, 58].map((width, index) => (
                <div
                  key={index}
                  className="h-[2px] rounded-full bg-[#c9bda8]"
                  style={{ width: `${width}%` }}
                />
              ))}
            </div>
            <p className="mt-6 font-serif text-[11px] italic text-[#7a6e5b]">
              The first line is still a question.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
