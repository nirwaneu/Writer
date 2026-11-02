"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Loader2, RotateCcw, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type PromptGroup = "System prompts" | "Task instructions";

type PromptDefinition = {
  key: string;
  label: string;
  description: string;
  group: PromptGroup;
  defaultValue: string;
};

type PromptsResponse = {
  prompts?: Record<string, string>;
  definitions?: PromptDefinition[];
  error?: { message?: string };
};

const GROUPS: PromptGroup[] = ["System prompts", "Task instructions"];

export function PromptTemplatesPanel() {
  const [definitions, setDefinitions] = useState<PromptDefinition[]>([]);
  const [prompts, setPrompts] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch("/api/prompts", { cache: "no-store" });
        const payload = (await response.json().catch(() => null)) as PromptsResponse | null;
        if (cancelled) return;
        if (!response.ok || !payload?.prompts || !payload.definitions) {
          setError(payload?.error?.message || "Prompt templates could not be loaded.");
          setLoading(false);
          return;
        }
        setDefinitions(payload.definitions);
        setPrompts(payload.prompts);
        setSaved(payload.prompts);
        setLoading(false);
      } catch {
        if (!cancelled) {
          setError("Could not reach the app server.");
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const dirty = useMemo(
    () => definitions.some((definition) => (prompts[definition.key] ?? "") !== (saved[definition.key] ?? "")),
    [definitions, prompts, saved],
  );

  function update(key: string, value: string) {
    setPrompts((current) => ({ ...current, [key]: value }));
    if (error) setError(null);
  }

  function resetToDefault(definition: PromptDefinition) {
    update(definition.key, definition.defaultValue);
  }

  async function save() {
    if (!dirty || saving) return;
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/prompts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompts }),
      });
      const payload = (await response.json().catch(() => null)) as PromptsResponse | null;
      if (!response.ok || !payload?.prompts) {
        setError(payload?.error?.message || "Prompt templates could not be saved.");
        return;
      }
      setPrompts(payload.prompts);
      setSaved(payload.prompts);
      toast.success("Prompt templates saved.");
    } catch {
      setError("Could not reach the app server.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-border bg-[#0d131a] px-5 py-10 text-[12px] text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading prompt templates…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-lg border border-border bg-[#0d131a]">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-5 py-3.5">
          <div>
            <h2 className="text-[13px] font-medium">Prompt Templates</h2>
            <p className="mt-0.5 max-w-2xl text-[11px] leading-relaxed text-muted-foreground">
              Global instructions for every model call. Edit the text or the placeholders in
              <span className="font-mono"> {"{{braces}}"}</span>. Empty prompts fall back to the
              built-in default.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {dirty ? (
              <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <span className="size-1.5 rounded-full bg-primary" />
                Unsaved
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <Check className="size-3.5 text-[#86bd93]" />
                Saved
              </span>
            )}
            <Button onClick={() => void save()} disabled={!dirty || saving}>
              {saving ? <Loader2 className="animate-spin" /> : <Save />}
              {saving ? "Saving…" : "Save prompts"}
            </Button>
          </div>
        </div>

        {error ? (
          <p className="mx-5 mt-4 rounded-md border border-[#5a2c25] bg-[#241411] p-2.5 text-[11.5px] leading-relaxed text-[#f2937f]">
            {error}
          </p>
        ) : null}

        <div className="divide-y divide-border">
          {GROUPS.map((group) => {
            const items = definitions.filter((definition) => definition.group === group);
            if (!items.length) return null;
            return (
              <section key={group} className="px-5 py-5">
                <h3 className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#f2c477]">
                  {group}
                </h3>
                <div className="mt-4 space-y-5">
                  {items.map((definition) => (
                    <div key={definition.key} className="space-y-1.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <Label htmlFor={`prompt-${definition.key}`} className="text-[12.5px]">
                          {definition.label}
                        </Label>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="text-muted-foreground"
                          onClick={() => resetToDefault(definition)}
                        >
                          <RotateCcw />
                          Default
                        </Button>
                      </div>
                      <p className="text-[10.5px] leading-relaxed text-muted-foreground">
                        {definition.description}
                      </p>
                      <Textarea
                        id={`prompt-${definition.key}`}
                        value={prompts[definition.key] ?? definition.defaultValue}
                        onChange={(event) => update(definition.key, event.target.value)}
                        spellCheck={false}
                        className={cn(
                          "min-h-40 max-h-[60vh] resize-y overflow-y-auto font-mono text-[11.5px] leading-relaxed",
                        )}
                      />
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </div>

      <p className="text-[10.5px] leading-relaxed text-muted-foreground">
        These global defaults are used by every request. A book or preset with its own system
        prompt overrides the matching global system prompt.
      </p>
    </div>
  );
}