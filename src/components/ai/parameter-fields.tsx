"use client";

import { useId } from "react";
import { Info } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { GenerationParams } from "@/lib/schemas";
import { cn } from "@/lib/utils";

type ParamKey = Exclude<keyof GenerationParams, "reasoningEffort">;

const FIELDS: Array<{
  key: ParamKey;
  label: string;
  min: number;
  max: number;
  step: number;
  low: string;
  high: string;
  tooltip: string;
  integer?: boolean;
}> = [
  {
    key: "temperature",
    label: "Temperature",
    min: 0,
    max: 2,
    step: 0.05,
    low: "focused",
    high: "wild",
    tooltip:
      "Controls randomness. Lower values keep the model close to its most likely wording; higher values produce more variation and surprise. 0–2.",
  },
  {
    key: "topP",
    label: "Top-P",
    min: 0,
    max: 1,
    step: 0.01,
    low: "narrow",
    high: "full",
    tooltip:
      "Nucleus sampling. The model considers the smallest set of tokens whose combined probability reaches this value. 1 means no filtering. Usually tune this or temperature, not both.",
  },
  {
    key: "topK",
    label: "Top-K",
    min: 0,
    max: 200,
    step: 1,
    low: "off",
    high: "200",
    integer: true,
    tooltip:
      "Limits each step to the K most likely tokens. 0 disables the limit. Not every OpenAI-compatible provider supports top_k; leave it at 0 if your provider rejects it.",
  },
  {
    key: "frequencyPenalty",
    label: "Frequency penalty",
    min: -2,
    max: 2,
    step: 0.1,
    low: "repetition",
    high: "variety",
    tooltip:
      "Penalizes tokens by how often they have already appeared. Positive values reduce repeated wording; negative values encourage it. −2 to 2.",
  },
  {
    key: "presencePenalty",
    label: "Presence penalty",
    min: -2,
    max: 2,
    step: 0.1,
    low: "return",
    high: "new ground",
    tooltip:
      "Penalizes tokens that have appeared at all. Positive values push the model toward new topics and phrasing; negative values let it return to familiar ground. −2 to 2.",
  },
];

export function GenerationParamsFields({
  params,
  onChange,
  className,
}: {
  params: GenerationParams;
  onChange: (params: GenerationParams) => void;
  className?: string;
}) {
  return (
    <div className={cn("space-y-3", className)}>
      <div className="grid gap-4 sm:grid-cols-2">
        {FIELDS.map((field) => (
          <ParameterField
            key={field.key}
            field={field}
            value={params[field.key]}
            onChange={(value) => onChange({ ...params, [field.key]: value })}
          />
        ))}
      </div>
      <ReasoningEffortField
        value={params.reasoningEffort}
        onChange={(value) => onChange({ ...params, reasoningEffort: value })}
      />
    </div>
  );
}

function ReasoningEffortField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const listId = useId();
  return (
    <div className="rounded-md border border-border bg-[#0c1218] px-3 py-2.5">
      <div className="flex items-center gap-1.5">
        <Label htmlFor={`reasoning-${listId}`} className="text-[12px]">
          Reasoning effort
        </Label>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-label="About reasoning effort"
              className="rounded p-0.5 text-muted-foreground/70 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Info className="size-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-80 text-[11.5px] leading-relaxed">
            Provider-specific reasoning budget. Common values are low, medium, and high; any
            custom string or number is passed through unchanged. Omitted from the request when
            left blank.
          </TooltipContent>
        </Tooltip>
      </div>
      <Input
        id={`reasoning-${listId}`}
        list={listId}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Optional ? low, medium, high, or custom"
        spellCheck={false}
        maxLength={100}
        className="mt-2 h-8 text-[12px]"
      />
      <datalist id={listId}>
        <option value="low" />
        <option value="medium" />
        <option value="high" />
      </datalist>
      <p className="mt-1.5 text-[10px] leading-relaxed text-muted-foreground">
        Optional. Sent as <span className="font-mono">reasoning_effort</span> only when non-empty.
      </p>
    </div>
  );
}

function ParameterField({
  field,
  value,
  onChange,
}: {
  field: (typeof FIELDS)[number];
  value: number;
  onChange: (value: number) => void;
}) {
  const display = field.integer ? String(Math.round(value)) : value.toFixed(2);

  function commit(next: number) {
    if (!Number.isFinite(next)) return;
    const clamped = Math.min(field.max, Math.max(field.min, next));
    onChange(field.integer ? Math.round(clamped) : clamped);
  }

  return (
    <div className="rounded-md border border-border bg-[#0c1218] px-3 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="truncate text-[12px] font-medium text-foreground/90">{field.label}</span>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label={`About ${field.label}`}
                className="rounded p-0.5 text-muted-foreground/70 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Info className="size-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-72 text-[11.5px] leading-relaxed">
              {field.tooltip}
            </TooltipContent>
          </Tooltip>
        </div>
        <input
          type="number"
          aria-label={`${field.label} value`}
          value={display}
          min={field.min}
          max={field.max}
          step={field.step}
          onChange={(event) => commit(Number(event.target.value))}
          className="h-6 w-14 rounded border border-input bg-[#0b1016] px-1.5 text-right font-mono text-[11px] tabular text-foreground outline-none focus:border-[#5b4a2c] focus:ring-2 focus:ring-ring/30"
        />
      </div>
      <input
        type="range"
        aria-label={field.label}
        value={value}
        min={field.min}
        max={field.max}
        step={field.step}
        onChange={(event) => commit(Number(event.target.value))}
        className="mt-2 h-1 w-full cursor-pointer appearance-none rounded-full bg-[#26313d] accent-[#f2a93b]"
      />
      <div className="mt-1 flex justify-between font-mono text-[9px] text-muted-foreground/70">
        <span>{field.low}</span>
        <span>{field.high}</span>
      </div>
    </div>
  );
}
