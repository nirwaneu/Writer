"use client";

import { Info } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { GenerationParamsFields } from "@/components/ai/parameter-fields";
import { ModelCombobox } from "@/components/models/model-combobox";
import { ROLE_LABELS, type PresetRole } from "@/lib/presets/constants";
import type { RoleConfig } from "@/lib/schemas";
import type { ModelOption, ProviderModelGroup } from "@/lib/ai/model-options";

const ROLE_HINTS: Record<PresetRole, string> = {
  planner: "Thinks with you in the right rail. It plans beats; it does not write prose.",
  executor: "Writes the chapter into the left page from the Planner's plan.",
  summarizer: "Maintains the Story Vault after each chapter, and distills premises and titles.",
  imagePrompter: "Turns chapter summaries and book titles into visual prompts for illustration models.",
  titleGenerator: "Names books and chapters from the provided context. Uses the Planner model.",
};

export function RoleSettingsEditor({
  role,
  value,
  onChange,
  model,
  onModelChange,
  modelGroups,
  modelOptions,
  modelLoading,
  modelError,
}: {
  role: PresetRole;
  value: RoleConfig;
  onChange: (next: RoleConfig) => void;
  model?: string;
  onModelChange?: (model: string) => void;
  modelGroups?: ProviderModelGroup[];
  modelOptions?: ModelOption[];
  modelLoading?: boolean;
  modelError?: string | null;
}) {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-4">
        <div>
          <h3 className="text-[14px] font-semibold">{ROLE_LABELS[role]}</h3>
          <p className="mt-0.5 max-w-xl text-[11.5px] leading-relaxed text-muted-foreground">
            {ROLE_HINTS[role]}
          </p>
        </div>
      </div>

      {onModelChange ? (
        <div className="space-y-1.5">
          <Label htmlFor={`model-${role}`}>Model for this book</Label>
          <ModelCombobox
            id={`model-${role}`}
            value={model ?? ""}
            onChange={onModelChange}
            groups={modelGroups ?? []}
            options={modelOptions ?? []}
            loading={modelLoading}
            error={modelError}
            placeholder="Choose a model?"
          />
          <p className="text-[10.5px] leading-relaxed text-muted-foreground">
            Models can come from any connected provider. The provider connection and API key
            stay global. This choice is used only for this book.
          </p>
        </div>
      ) : null}

      <div className="space-y-1.5">
        <div className="flex items-center gap-1.5">
          <Label htmlFor={`prompt-${role}`}>System prompt</Label>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label="About system prompts"
                className="rounded p-0.5 text-muted-foreground/70 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Info className="size-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-80 text-[11.5px] leading-relaxed">
              This is the system message for the role. VibeDraft appends the Story Vault, the current
              chapter, and the task instructions after it, so the model always gets the book
              context even if you rewrite this prompt.
            </TooltipContent>
          </Tooltip>
        </div>
        <Textarea
          id={`prompt-${role}`}
          value={value.systemPrompt}
          onChange={(event) =>
            onChange({ ...value, systemPrompt: event.target.value })
          }
          className="min-h-64 resize-y font-sans text-[12.5px] leading-relaxed"
          spellCheck
        />
        <p className="text-[10.5px] leading-relaxed text-muted-foreground">
          Runs first. The vault and task block are appended automatically. No character limit.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={`injection-after-system-${role}`}>
            Injection: After System Prompt
          </Label>
          <Textarea
            id={`injection-after-system-${role}`}
            value={value.injectionAfterSystemPrompt ?? ""}
            onChange={(event) =>
              onChange({ ...value, injectionAfterSystemPrompt: event.target.value })
            }
            className="min-h-32 resize-y font-sans text-[12px] leading-relaxed"
            placeholder="Optional assistant message inserted immediately after the system prompt."
            spellCheck
          />
          <p className="text-[10.5px] leading-relaxed text-muted-foreground">
            Sent as an <span className="font-mono">assistant</span> message at position 2.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={`injection-after-last-${role}`}>
            Injection: After Last Message
          </Label>
          <Textarea
            id={`injection-after-last-${role}`}
            value={value.injectionAfterLastMessage ?? ""}
            onChange={(event) =>
              onChange({ ...value, injectionAfterLastMessage: event.target.value })
            }
            className="min-h-32 resize-y font-sans text-[12px] leading-relaxed"
            placeholder="Optional assistant message appended after the final user message."
            spellCheck
          />
          <p className="text-[10.5px] leading-relaxed text-muted-foreground">
            Sent as a final <span className="font-mono">assistant</span> message.
          </p>
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center gap-1.5">
          <h4 className="text-[12.5px] font-medium">Generation parameters</h4>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label="About generation parameters"
                className="rounded p-0.5 text-muted-foreground/70 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Info className="size-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-80 text-[11.5px] leading-relaxed">
              Sent to the OpenAI-compatible endpoint with every call for this role. Top-K is
              omitted when set to 0, because some providers reject unknown fields.
            </TooltipContent>
          </Tooltip>
        </div>
        <GenerationParamsFields
          params={value.params}
          onChange={(params) => onChange({ ...value, params })}
        />
      </div>
    </div>
  );
}
