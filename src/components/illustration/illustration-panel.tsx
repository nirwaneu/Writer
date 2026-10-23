"use client";

import { useMemo, useState } from "react";
import { ImageIcon, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { illustrationUrl } from "@/lib/pages";
import { useAvailableModels } from "@/lib/use-available-models";
import type { Chapter, ImageAspectRatio, Outline } from "@/lib/schemas";

const ASPECTS: Array<{ value: ImageAspectRatio; label: string; hint: string }> = [
  { value: "portrait", label: "Portrait", hint: "1024×1792 · book page" },
  { value: "square", label: "Square", hint: "1024×1024" },
  { value: "landscape", label: "Landscape", hint: "1792×1024" },
];

export function IllustrationPanel({
  slug,
  pageNumber,
  chapter,
  providers,
  onSaved,
}: {
  slug: string;
  pageNumber: number;
  chapter: Chapter;
  providers: Array<{ id: string; name: string }>;
  onSaved: (outline: Outline) => void;
}) {
  const [prompt, setPrompt] = useState(chapter.image?.prompt ?? "");
  const [negativePrompt, setNegativePrompt] = useState(
    chapter.image?.negativePrompt ?? "",
  );
  const [aspectRatio, setAspectRatio] = useState<ImageAspectRatio>(
    chapter.image?.aspectRatio ?? "portrait",
  );
  const [selectedProviderId, setSelectedProviderId] = useState(
    chapter.image?.providerId ?? "",
  );
  const providerId = selectedProviderId || providers[0]?.id || "";
  const [model, setModel] = useState(chapter.image?.model ?? "");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { options, loading } = useAvailableModels();

  const modelOptions = useMemo(
    () =>
      options
        .filter((option) => option.providerId === providerId)
        .map((option) => option.model),
    [options, providerId],
  );
  const listId = `illustration-models-${pageNumber}`;
  const imagePath = chapter.image?.path;
  const canGenerate = Boolean(
    prompt.trim() && providerId && model.trim() && !generating,
  );

  async function generate() {
    if (!canGenerate) return;
    setGenerating(true);
    setError(null);
    try {
      const response = await fetch("/api/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug,
          pageNumber,
          providerId,
          model: model.trim(),
          prompt,
          negativePrompt,
          aspectRatio,
        }),
      });
      const payload = (await response.json()) as {
        outline?: Outline;
        error?: { message?: string };
      };
      if (!response.ok || !payload.outline) {
        setError(payload.error?.message || "The illustration could not be generated.");
        return;
      }
      onSaved(payload.outline);
      setError(null);
      toast.success("Illustration generated and saved.");
    } catch {
      setError("Could not reach the app server while generating the illustration.");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[var(--page-line)] pb-4">
        <div>
          <p className="paper-kicker font-mono text-[9px] uppercase tracking-[0.18em]">
            Illustration page
          </p>
          <h2 className="paper-title mt-1 font-serif text-[1.5rem] leading-tight">
            A plate for the book.
          </h2>
          <p className="paper-soft mt-1 max-w-xl text-[11.5px] leading-relaxed">
            Generate an image with any configured provider. The file is stored on the data
            volume beside your manuscript.
          </p>
        </div>
        <span className="paper-kicker font-mono text-[9px] uppercase tracking-[0.14em]">
          Page {pageNumber}
        </span>
      </div>

      {imagePath ? (
        <figure className="overflow-hidden rounded-[4px] border border-[var(--page-line)] bg-[var(--page-code-bg)] p-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={illustrationUrl(slug, imagePath)}
            alt={chapter.image?.prompt || "Book illustration"}
            className="mx-auto max-h-[70vh] w-auto max-w-full object-contain"
          />
          <figcaption className="paper-kicker mt-2 px-1 font-mono text-[9px] uppercase tracking-[0.14em]">
            {chapter.image?.model} · {chapter.image?.aspectRatio}
          </figcaption>
        </figure>
      ) : (
        <div className="flex min-h-48 flex-col items-center justify-center gap-3 rounded-[4px] border border-dashed border-[var(--page-line)] px-6 py-10 text-center">
          <span className="flex size-10 items-center justify-center rounded-full border border-[var(--page-line)]">
            <ImageIcon className="size-4 paper-soft" />
          </span>
          <div>
            <p className="text-[13px] font-medium">No illustration yet.</p>
            <p className="paper-soft mt-1 text-[11.5px] leading-relaxed">
              Describe the plate below and generate it.
            </p>
          </div>
        </div>
      )}

      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor={`illustration-prompt-${pageNumber}`}>Prompt</Label>
          <Textarea
            id={`illustration-prompt-${pageNumber}`}
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder="A quiet coastal map room at dusk, ink wash, warm lamplight, painterly book illustration…"
            className="min-h-28 text-[12.5px] leading-relaxed"
            maxLength={4_000}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={`illustration-negative-${pageNumber}`}>
            Negative prompt <span className="text-muted-foreground">(optional)</span>
          </Label>
          <Textarea
            id={`illustration-negative-${pageNumber}`}
            value={negativePrompt}
            onChange={(event) => setNegativePrompt(event.target.value)}
            placeholder="text, watermark, signature, blurry, low contrast…"
            className="min-h-14 text-[12px] leading-relaxed"
            maxLength={2_000}
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor={`illustration-provider-${pageNumber}`}>Provider</Label>
            <Select
              id={`illustration-provider-${pageNumber}`}
              value={providerId}
              onChange={(event) => {
                setSelectedProviderId(event.target.value);
                setModel("");
              }}
              disabled={!providers.length}
            >
              {providers.length ? null : <option value="">No providers configured</option>}
              {providers.map((provider) => (
                <option key={provider.id} value={provider.id}>
                  {provider.name}
                </option>
              ))}
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={`illustration-model-${pageNumber}`}>Image model</Label>
            <Input
              id={`illustration-model-${pageNumber}`}
              value={model}
              onChange={(event) => setModel(event.target.value)}
              list={listId}
              placeholder={loading ? "Loading models…" : "flux, sdxl, dall-e-3…"}
              spellCheck={false}
              maxLength={200}
            />
            <datalist id={listId}>
              {modelOptions.map((option) => (
                <option key={option} value={option} />
              ))}
            </datalist>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={`illustration-aspect-${pageNumber}`}>Aspect ratio</Label>
            <Select
              id={`illustration-aspect-${pageNumber}`}
              value={aspectRatio}
              onChange={(event) =>
                setAspectRatio(event.target.value as ImageAspectRatio)
              }
            >
              {ASPECTS.map((aspect) => (
                <option key={aspect.value} value={aspect.value}>
                  {aspect.label} · {aspect.hint}
                </option>
              ))}
            </Select>
          </div>
        </div>

        {error ? (
          <p className="rounded-md border border-[#5a2c25] bg-[#241411] p-3 text-[12px] leading-relaxed text-[#f2937f]">
            {error}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <p className="paper-soft text-[10.5px] leading-relaxed">
            Saved to <span className="font-mono">novels/{slug}/illustrations/</span>
          </p>
          <Button onClick={() => void generate()} disabled={!canGenerate}>
            {generating ? <Loader2 className="animate-spin" /> : <Sparkles />}
            {generating ? "Generating…" : imagePath ? "Regenerate illustration" : "Generate"}
          </Button>
        </div>
      </div>
    </div>
  );
}
