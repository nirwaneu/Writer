"use client";

import { useState } from "react";import { ImageIcon, Loader2, Sparkles, Wand2 } from "lucide-react";
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
  immersive = false,
}: {
  slug: string;
  pageNumber: number;
  chapter: Chapter;
  providers: Array<{ id: string; name: string }>;
  onSaved: (outline: Outline) => void;
  immersive?: boolean;
}) {
  const [prompt, setPrompt] = useState(chapter.image?.prompt ?? "");
  const [styleId, setStyleId] = useState(DEFAULT_ART_STYLE_ID);
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
  const [writingPrompt, setWritingPrompt] = useState(false);
  const [controlsOpen, setControlsOpen] = useState(!chapter.image?.path);
  const [error, setError] = useState<string | null>(null);
  const { options, loading } = useAvailableModels();
  const { behavior } = useEnterBehavior();

  const providerOptions = options.filter((option) => option.providerId === providerId);
  const flaggedOptions = providerOptions.filter((option) => option.isImage);
  const modelOptions = (
    flaggedOptions.length ? flaggedOptions : providerOptions
  ).map((option) => option.model);
  const showsAllModels =
    providerOptions.length > 0 && flaggedOptions.length === 0;
  const listId = `illustration-models-${pageNumber}`;
  const imagePath = chapter.image?.path;
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
        body: JSON.stringify({
          slug,
          kind: "chapter",
          pageNumber,
        }),
      });
      const payload = (await response.json()) as {
        prompt?: string;
        error?: { message?: string };
      };
      if (!response.ok || !payload.prompt) {
        setError(payload.error?.message || "The image prompt could not be written.");
        return;
      }
      setPrompt(payload.prompt);
      toast.success("Image prompt written. Review it before generating.");
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
      const response = await fetch("/api/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug,
          pageNumber,
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
        setError(payload.error?.message || "The illustration could not be generated.");
        return;
      }
      onSaved(payload.outline);
      setError(null);
      setControlsOpen(false);
      toast.success("Illustration generated and saved.");
    } catch {
      setError("Could not reach the app server while generating the illustration.");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div
      className={
        immersive
          ? "flex h-full min-h-0 flex-col gap-3 overflow-y-auto p-2 sm:p-3"
          : "space-y-6"
      }
    >
      {immersive ? null : (
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
      )}

      {imagePath ? (
        <figure
          className={
            immersive
              ? "flex min-h-0 flex-1 overflow-hidden rounded-[4px] bg-[#070b10]"
              : "overflow-hidden rounded-[4px] border border-[var(--page-line)] bg-[var(--page-code-bg)] p-2"
          }
          style={
            immersive
              ? {
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  width: "100%",
                  height: "100%",
                  padding: "10px",
                  boxSizing: "border-box",
                }
              : undefined
          }
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={illustrationUrl(slug, imagePath)}
            alt={chapter.image?.prompt || "Book illustration"}
            className={
              immersive
                ? "block object-contain"
                : "mx-auto max-h-[70vh] w-auto max-w-full object-contain"
            }
            style={
              immersive
                ? {
                    objectFit: "contain",
                    maxWidth: "100%",
                    maxHeight: "100%",
                    border: "1px solid rgba(150, 150, 150, 0.35)",
                    borderRadius: "0",
                    boxShadow: "0 6px 18px rgba(0,0,0,0.35)",
                  }
                : undefined
            }
          />
          {immersive ? null : (
            <figcaption className="paper-kicker mt-2 px-1 font-mono text-[9px] uppercase tracking-[0.14em]">
              {chapter.image?.model} · {chapter.image?.aspectRatio}
            </figcaption>
          )}
        </figure>
      ) : (
        <div
          className={
            immersive
              ? "flex min-h-48 flex-1 flex-col items-center justify-center gap-3 rounded-[4px] border border-dashed border-[var(--page-line)] px-6 py-10 text-center"
              : "flex min-h-48 flex-col items-center justify-center gap-3 rounded-[4px] border border-dashed border-[var(--page-line)] px-6 py-10 text-center"
          }
        >
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

      <details
        open={controlsOpen}
        onToggle={(event) => setControlsOpen(event.currentTarget.open)}
        className={
          immersive
            ? "shrink-0 rounded-md border border-[var(--page-line)] bg-[var(--page-code-bg)] px-3 py-2"
            : "rounded-md border border-[var(--page-line)] bg-[var(--page-code-bg)] px-3 py-2"
        }
      >
        <summary className="cursor-pointer select-none font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
          Prompt &amp; generation controls
        </summary>
        <div className="mt-3 space-y-3">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Label htmlFor={`illustration-prompt-${pageNumber}`}>Prompt</Label>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => void autoWritePrompt()}
              disabled={writingPrompt || generating}
              title="Use the Image Prompter model and the previous chapter summary"
            >
              {writingPrompt ? <Loader2 className="animate-spin" /> : <Wand2 />}
              {writingPrompt ? "Writing prompt…" : "Auto-Write Image Prompt"}
            </Button>
          </div>
          <Textarea
            id={`illustration-prompt-${pageNumber}`}
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
            placeholder="A quiet coastal map room at dusk, ink wash, warm lamplight, painterly book illustration…"
            className="min-h-28 text-[12.5px] leading-relaxed"
            maxLength={4_000}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={`illustration-style-${pageNumber}`}>Illustration Style</Label>
          <Select
            id={`illustration-style-${pageNumber}`}
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
            {showsAllModels ? (
              <p className="text-[10px] leading-relaxed text-muted-foreground">
                No image models flagged for this provider; showing all models. Flag them in
                Settings → Providers → Image models.
              </p>
            ) : null}
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
      </details>
    </div>
  );
}
