"use client";

import { useCallback, useEffect, useState } from "react";
import {
  BookMarked,
  Check,
  Loader2,
  RefreshCw,
  Settings2,
  SlidersHorizontal,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RoleSettingsEditor } from "@/components/ai/role-settings-editor";
import { clonePresetRoles } from "@/lib/presets/defaults";
import { AI_ROLES, ROLE_LABELS, type AIRole } from "@/lib/presets/constants";
import type { BookConfig, ModelRoles, Preset } from "@/lib/schemas";
import type { ModelOption, ProviderModelGroup } from "@/lib/ai/model-options";

type ConfigResponse = {
  config?: BookConfig;
  source?: "local" | "fallback";
  presets?: Preset[];
  defaultPresetId?: string;
  globalModels?: ModelRoles | null;
  error?: { message?: string };
};

export function BookSettingsDialog({
  slug,
  onSaved,
}: {
  slug: string;
  onSaved?: (config: BookConfig) => void;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingModels, setLoadingModels] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modelNote, setModelNote] = useState<string | null>(null);
  const [config, setConfig] = useState<BookConfig | null>(null);
  const [source, setSource] = useState<"local" | "fallback">("fallback");
  const [presets, setPresets] = useState<Preset[]>([]);
  const [defaultPresetId, setDefaultPresetId] = useState("");
  const [modelGroups, setModelGroups] = useState<ProviderModelGroup[]>([]);
  const [modelOptions, setModelOptions] = useState<ModelOption[]>([]);
  const [activeRole, setActiveRole] = useState<AIRole>("planner");
  const [presetToLoad, setPresetToLoad] = useState("");

  const loadModels = useCallback(async () => {
    setLoadingModels(true);
    setModelNote(null);
    try {
      const response = await fetch("/api/models", { cache: "no-store" });
      const payload = (await response.json()) as {
        groups?: ProviderModelGroup[];
        options?: ModelOption[];
        error?: { message?: string };
      };
      if (!response.ok) {
        setModelNote(payload.error?.message || "Could not list models. Try again.");
        return;
      }
      setModelGroups(payload.groups ?? []);
      setModelOptions(payload.options ?? []);
      const failed = (payload.groups ?? []).filter((group) => group.error);
      if (failed.length) {
        setModelNote(
          failed
            .map((group) => `${group.providerName}: ${group.error}`)
            .join(" · "),
        );
      }
    } catch {
      setModelNote("Could not list models. Try again.");
    } finally {
      setLoadingModels(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);
      setConfig(null);
      setModelGroups([]);
      setModelOptions([]);
      setModelNote(null);
      setPresetToLoad("");
      try {
        const response = await fetch(`/api/novels/${slug}/config`, { cache: "no-store" });
        const payload = (await response.json()) as ConfigResponse;
        if (!response.ok || !payload.config) {
          if (!cancelled) {
            setError(payload.error?.message || "The book settings could not be loaded.");
            setLoading(false);
          }
          return;
        }
        if (cancelled) return;
        setConfig(payload.config);
        setSource(payload.source ?? "fallback");
        setPresets(payload.presets ?? []);
        setDefaultPresetId(payload.defaultPresetId ?? "");
        setLoading(false);
        void loadModels();
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
  }, [open, slug, loadModels]);

  function updateRole(role: AIRole, value: BookConfig["roles"][AIRole]) {
    setConfig((current) =>
      current ? { ...current, roles: { ...current.roles, [role]: value } } : current,
    );
  }

  function updateModel(role: AIRole, model: string) {
    setConfig((current) =>
      current ? { ...current, models: { ...current.models, [role]: model } } : current,
    );
  }

  function applyPreset() {
    if (!config) return;
    const preset = presets.find((item) => item.id === presetToLoad);
    if (!preset) return;
    setConfig({
      ...config,
      presetId: preset.id,
      presetName: preset.name,
      roles: clonePresetRoles(preset.roles),
    });
    setPresetToLoad("");
    toast.info(`Loaded “${preset.name}” into this book. Save to keep it.`);
  }

  async function save() {
    if (!config) return;
    if (AI_ROLES.some((role) => !config.models[role].trim())) {
      setError("Choose a model for all three roles.");
      return;
    }
    if (AI_ROLES.some((role) => !config.roles[role].systemPrompt.trim())) {
      setError("Every role needs a system prompt.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/novels/${slug}/config`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          presetId: config.presetId,
          presetName: config.presetName,
          models: config.models,
          roles: config.roles,
        }),
      });
      const payload = (await response.json()) as ConfigResponse;
      if (!response.ok || !payload.config) {
        setError(payload.error?.message || "The book settings could not be saved.");
        return;
      }
      setConfig(payload.config);
      setSource("local");
      onSaved?.(payload.config);
      setOpen(false);
      toast.success("Book settings saved. New generations use them.");
    } catch {
      setError("Could not reach the app server.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1.5" aria-label="Book model settings">
          <Settings2 />
          <span className="hidden sm:inline">Book settings</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Book model settings</DialogTitle>
          <DialogDescription>
            Prompts, sampling parameters, and models for this book only. Stored in{" "}
            <span className="font-mono text-[11px]">vibedraft.db</span>.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="space-y-4 py-2">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-28 w-full" />
          </div>
        ) : null}

        {!loading && config ? (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={source === "local" ? "success" : "amber"}>
                  {source === "local" ? "Local settings" : "Global fallback"}
                </Badge>
                <span className="text-[11.5px] text-muted-foreground">
                  Based on <span className="text-foreground/80">{config.presetName}</span>
                </span>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => void loadModels()}
                disabled={loadingModels}
              >
                {loadingModels ? <Loader2 className="animate-spin" /> : <RefreshCw />}
                Refresh models
              </Button>
            </div>

            <div
              className={
                source === "local"
                  ? "flex items-start gap-2.5 rounded-md border border-[#2d4a36] bg-[#14211a] p-3 text-[11.5px] leading-relaxed text-[#a9c9b0]"
                  : "flex items-start gap-2.5 rounded-md border border-[#5b431c] bg-[#1b1409] p-3 text-[11.5px] leading-relaxed text-[#c9a86e]"
              }
            >
              {source === "local" ? (
                <BookMarked className="mt-0.5 size-4 shrink-0" />
              ) : (
                <SlidersHorizontal className="mt-0.5 size-4 shrink-0" />
              )}
              <p>
                {source === "local"
                  ? "This book is independent. Global preset edits and default model changes do not affect it."
                  : "This book is still using global defaults. Saving here writes its own local settings row and makes it independent."}
              </p>
            </div>

            <div className="flex flex-wrap items-end gap-2 rounded-md border border-border bg-[#0c1218] p-3">
              <div className="min-w-48 flex-1 space-y-1.5">
                <Label htmlFor="load-preset">Load a preset into this book</Label>
                <Select
                  id="load-preset"
                  value={presetToLoad}
                  onChange={(event) => setPresetToLoad(event.target.value)}
                >
                  <option value="">Choose a preset…</option>
                  {presets.map((preset) => (
                    <option key={preset.id} value={preset.id}>
                      {preset.name}
                      {preset.id === defaultPresetId ? " · default" : ""}
                    </option>
                  ))}
                </Select>
              </div>
              <Button
                type="button"
                variant="secondary"
                onClick={applyPreset}
                disabled={!presetToLoad}
              >
                Load
              </Button>
              <p className="w-full text-[10.5px] leading-relaxed text-muted-foreground">
                Copies prompts and parameters into the form. Models stay as they are. Nothing is
                saved until you press Save for this book.
              </p>
            </div>

            <Tabs value={activeRole} onValueChange={(value) => setActiveRole(value as AIRole)}>
              <TabsList>
                {AI_ROLES.map((role) => (
                  <TabsTrigger key={role} value={role}>
                    {ROLE_LABELS[role]}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>

            <RoleSettingsEditor
              role={activeRole}
              value={config.roles[activeRole]}
              onChange={(value) => updateRole(activeRole, value)}
              model={config.models[activeRole]}
              onModelChange={(model) => updateModel(activeRole, model)}
              modelGroups={modelGroups}
              modelOptions={modelOptions}
              modelLoading={loadingModels}
              modelError={modelNote}
            />

            {modelNote ? (
              <p className="rounded-md border border-border bg-[#0c1218] p-2.5 text-[10.5px] leading-relaxed text-muted-foreground">
                {modelNote}
              </p>
            ) : null}

            {error ? (
              <p className="rounded-md border border-[#5a2c25] bg-[#241411] p-3 text-[12px] text-[#f2937f]">
                {error}
              </p>
            ) : null}

            <DialogFooter className="sticky bottom-0 z-10 -mx-5 -mb-5 items-center border-t border-border bg-popover px-5 py-3 sm:justify-between">
              <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <Check className="size-3.5 text-[#86bd93]" />
                Affects this book only
              </span>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => setOpen(false)} disabled={saving}>
                  Cancel
                </Button>
                <Button onClick={() => void save()} disabled={saving}>
                  {saving ? <Loader2 className="animate-spin" /> : <Check />}
                  {saving ? "Saving…" : "Save for this book"}
                </Button>
              </div>
            </DialogFooter>
          </div>
        ) : null}

        {!loading && error && !config ? (
          <p className="rounded-md border border-[#5a2c25] bg-[#241411] p-3 text-[12px] text-[#f2937f]">
            {error}
          </p>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
