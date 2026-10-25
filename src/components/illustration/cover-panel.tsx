"use client";

import { useState } from "react";
import { ImageIcon, Loader2, Sparkles, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { illustrationUrl } from "@/lib/pages";
import { useAvailableModels } from "@/lib/use-available-models";
import { handleEnterKey, useEnterBehavior } from "@/lib/use-enter-behavior";
import {
  applyArtStyle,
  ART_STYLES,
  DEFAULT_ART_STYLE_ID,
  getArtStyle,
} from "@/lib/image-styles";
import type { Illustration, ImageAspectRatio, Outline } from "@/lib/schemas";

const ASPECTS: Array<{ value: ImageAspectRatio; label: string; hint: string }> = [
  { value: "portrait", label: "Portrait", hint: "1024×1792 · cover" },
  { value: "square", label: "Square", hint: "1024×1024" },
  { value: "landscape", label: "Landscape", hint: "1792×1024" },
];

export function CoverPanel({
  slug,
  title,
  cover,
  providers,
  onSaved,
}: {
  slug: string;
  title: string;
  cover?: Illustration;
  providers: Array<{ id: string; name: string }>;
  onSaved: (outline: Outline) => void;
}) {
  const [prompt, setPrompt] = useState(cover?.prompt ?? "");
  const [styleId, setStyleId] = useState(DEFAULT_ART_STYLE_ID);
  const [negativePrompt, setNegativePrompt] = useState(cover?.negativePrompt ?? "");
  const [aspectRatio, setAspectRatio] = useState<ImageAspectRatio>(
    cover?.aspectRatio ?? "portrait",
  );
  const [selectedProviderId, setSelectedProviderId] = useState(cover?.providerId ?? "");
  const providerId = selectedProviderId || providers[0]?.id || "";
  const [model, setModel] = useState(cover?.model ?? "");
  const [generating, setGenerating] = useState(false);
  const [writingPrompt, setWritingPrompt] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { options, loading } = useAvailableModels();
  const { behavior } = useEnterBehavior();

  const providerOptions = options.filter((option) => option.providerId === providerId);
  const flaggedOptions = providerOptions.filter((option) => option.isImage);
  const modelOptions = (flaggedOptions.length ? flaggedOptions : providerOptions).map(
    (option) => option.model,
  );
  const showsAllModels = providerOptions.length > 0 && flaggedOptions.length === 0;
  const listId = "cover-image-models";
  const canGenerate = Boolean(
    prompt.trim() && providerId && model.trim() && !generating,
  );

  async function autoWritePrompt() {
    setWritingPrompt(true);
    setError(null);
    try {
      const response = await fetch("/api/ai/image-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, kind: "cover" }),
      });
      const payload = (await response.json()) as {
        prompt?: string;
        error?: { message?: string };
      };
      if (!response.ok || !payload.prompt) {
        setError(payload.error?.message || "The cover prompt could not be written.");
        return;
      }
      setPrompt(payload.prompt);
      toast.success("Cover prompt written. Review it before generating.");
    } catch {
      setError("Could not reach the app server while writing the prompt.");
    } finally {
      setWritingPrompt(false);
    }
  }

  async function generate() {
    if (!canGenerate) return;
    setGenerating(true);
    setError(null);
    try {
      const response = await fetch("/api/generate-cover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug,
          providerId,
          model: model.trim(),
          prompt: applyArtStyle(prompt, styleId),
          basePrompt: prompt,
          negativePrompt,
          aspectRatio,
        }),
      });
      const payload = (await response.json()) as {
        outline?: Outline;
        error?: { message?: string };
      };
      if (!response.ok || !payload.outline) {
        setError(payload.error?.message || "The cover could not be generated.");
        return;
      }
      onSaved(payload.outline);
      toast.success("Cover illustration generated and saved.");
    } catch {
      setError("Could not reach the app server while generating the cover.");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-[13px] font-medium">Cover illustration</h3>
        <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
          Generate a cover for <span className="text-foreground/80">{title}</span>. It is
          stored on the data volume and shown on the book dashboard and library shelf.
        </p>
      </div>

      {cover?.path ? (
        <figure className="overflow-hidden rounded-md border border-border bg-[#0c1218] p-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={illustrationUrl(slug, cover.path)}
            alt={cover.prompt || `${title} cover`}
            className="mx-auto max-h-72 w-auto max-w-full object-contain"
          />
          <figcaption className="mt-2 px-1 font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
            {cover.model} · {cover.aspectRatio}
          </figcaption>
        </figure>
      ) : (
        <div className="flex items-center gap-3 rounded-md border border-dashed border-border bg-[#0c1218] p-4">
          <span className="flex size-9 items-center justify-center rounded-full border border-border">
            <ImageIcon className="size-4 text-muted-foreground" />
          </span>
          <div>
            <p className="text-[12.5px] font-medium">No cover yet.</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Use the title to auto-write a prompt, then generate the cover.
            </p>
          </div>
        </div>
      )}

      <div className="space-y-1.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Label htmlFor="cover-prompt">Cover prompt</Label>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => void autoWritePrompt()}
            disabled={writingPrompt || generating}
            title="Use the Image Prompter model and this book's title"
          >
            {writingPrompt ? <Loader2 className="animate-spin" /> : <Wand2 />}
            {writingPrompt ? "Writing prompt…" : "Auto-Write Image Prompt"}
          </Button>
        </div>
        <Textarea
          id="cover-prompt"
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          onKeyDown={(event) => {
            handleEnterKey({
              behavior,
              event,
              value: prompt,
              onChange: setPrompt,
              onSubmit: () => {
                if (canGenerate) void generate();
              },
            });
          }}
          placeholder="Iconic literary book cover, coastal map, ink wash, warm light…"
          className="min-h-24 text-[12.5px] leading-relaxed"
          maxLength={4_000}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="cover-style">Illustration Style</Label>
        <Select
          id="cover-style"
          value={styleId}
          onChange={(event) => setStyleId(event.target.value)}
        >
          {ART_STYLES.map((style) => (
            <option key={style.id} value={style.id}>
              {style.name}
            </option>
          ))}
        </Select>
        <p className="text-[10.5px] leading-relaxed text-muted-foreground">
          {getArtStyle(styleId).promptSuffix
            ? `Appended to the prompt: ${getArtStyle(styleId).promptSuffix.replace(/^,\s*/, "")}`
            : "Uses the prompt exactly as written."}
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="cover-negative">
          Negative prompt <span className="text-muted-foreground">(optional)</span>
        </Label>
        <Textarea
          id="cover-negative"
          value={negativePrompt}
          onChange={(event) => setNegativePrompt(event.target.value)}
          placeholder="text, title, watermark, signature, blurry…"
          className="min-h-12 text-[12px] leading-relaxed"
          maxLength={2_000}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="cover-provider">Provider</Label>
          <Select
            id="cover-provider"
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
          <Label htmlFor="cover-model">Image model</Label>
          <Input
            id="cover-model"
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
          {showsAllModels ? (
            <p className="text-[10px] leading-relaxed text-muted-foreground">
              No image models flagged for this provider; showing all models.
            </p>
          ) : null}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cover-aspect">Aspect ratio</Label>
          <Select
            id="cover-aspect"
            value={aspectRatio}
            onChange={(event) => setAspectRatio(event.target.value as ImageAspectRatio)}
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

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[10.5px] leading-relaxed text-muted-foreground">
          Saved to <span className="font-mono">novels/{slug}/illustrations/</span>
        </p>
        <Button onClick={() => void generate()} disabled={!canGenerate}>
          {generating ? <Loader2 className="animate-spin" /> : <Sparkles />}
          {generating ? "Generating…" : cover ? "Regenerate cover" : "Generate cover"}
        </Button>
      </div>
    </div>
  );
}
