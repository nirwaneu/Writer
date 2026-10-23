"use client";

import { useMemo, useState } from "react";
import {
  Check,
  Copy,
  Loader2,
  Plus,
  Save,
  Star,
  Trash2,
  Undo2,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { RoleSettingsEditor } from "@/components/ai/role-settings-editor";
import { clonePresetRoles } from "@/lib/presets/defaults";
import { AI_ROLES, ROLE_LABELS, type AIRole } from "@/lib/presets/constants";
import { cn } from "@/lib/utils";
import type { Preset, RoleConfig } from "@/lib/schemas";

type PresetResponse = {
  preset?: Preset;
  presets?: Preset[];
  defaultPresetId?: string;
  error?: { message?: string };
};

export function PresetManager({
  initialPresets,
  initialDefaultPresetId,
}: {
  initialPresets: Preset[];
  initialDefaultPresetId: string;
}) {
  const [presets, setPresets] = useState(initialPresets);
  const [defaultPresetId, setDefaultPresetId] = useState(initialDefaultPresetId);
  const [selectedId, setSelectedId] = useState(
    initialPresets.find((preset) => preset.id === initialDefaultPresetId)?.id ??
      initialPresets[0]?.id ??
      "",
  );
  const selected = presets.find((preset) => preset.id === selectedId) ?? presets[0];
  const [draft, setDraft] = useState<Preset>(() =>
    structuredClone(
      initialPresets.find((preset) => preset.id === initialDefaultPresetId) ??
        initialPresets[0],
    ),
  );
  const [activeRole, setActiveRole] = useState<AIRole>("planner");
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty = useMemo(
    () => Boolean(selected) && JSON.stringify(draft) !== JSON.stringify(selected),
    [draft, selected],
  );
  const isDefault = draft.id === defaultPresetId;
  const isBase = draft.builtIn;

  function applyResponse(payload: PresetResponse) {
    if (payload.presets) setPresets(payload.presets);
    if (payload.defaultPresetId) setDefaultPresetId(payload.defaultPresetId);
  }

  function selectPreset(id: string) {
    if (id === selectedId) return;
    if (dirty) {
      toast.info("Save or discard your changes before switching presets.");
      return;
    }
    const next = presets.find((preset) => preset.id === id);
    if (!next) return;
    setSelectedId(id);
    setDraft(structuredClone(next));
    setError(null);
  }

  function updateDraft(patch: Partial<Preset>) {
    setDraft((current) => ({ ...current, ...patch }));
  }

  function updateRole(role: AIRole, value: RoleConfig) {
    setDraft((current) => ({
      ...current,
      roles: { ...current.roles, [role]: value },
    }));
  }

  async function save() {
    if (!draft.name.trim()) {
      setError("Give the preset a name.");
      return;
    }
    if (AI_ROLES.some((role) => !draft.roles[role].systemPrompt.trim())) {
      setError("Every role needs a system prompt.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/presets/${draft.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: draft.name,
          description: draft.description,
          roles: draft.roles,
        }),
      });
      const payload = (await response.json()) as PresetResponse;
      if (!response.ok) {
        setError(payload.error?.message || "The preset could not be saved.");
        return;
      }
      applyResponse(payload);
      if (payload.preset) {
        setDraft(structuredClone(payload.preset));
        setSelectedId(payload.preset.id);
      }
      toast.success("Preset saved.");
    } catch {
      setError("Could not reach the app server.");
    } finally {
      setSaving(false);
    }
  }

  async function createPreset(mode: "new" | "duplicate") {
    if (dirty) {
      toast.info("Save or discard your changes before creating another preset.");
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const base = presets.find((preset) => preset.builtIn) ?? presets[0];
      const response = await fetch("/api/presets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name:
            mode === "duplicate"
              ? `${draft.name} copy`
              : "New preset",
          description:
            mode === "duplicate" ? draft.description : "A custom preset.",
          roles: clonePresetRoles(
            mode === "duplicate" ? draft.roles : base?.roles ?? draft.roles,
          ),
        }),
      });
      const payload = (await response.json()) as PresetResponse;
      if (!response.ok || !payload.preset) {
        setError(payload.error?.message || "The preset could not be created.");
        return;
      }
      applyResponse(payload);
      setSelectedId(payload.preset.id);
      setDraft(structuredClone(payload.preset));
      setActiveRole("planner");
      toast.success(mode === "duplicate" ? "Preset duplicated." : "Preset created.");
    } catch {
      setError("Could not reach the app server.");
    } finally {
      setCreating(false);
    }
  }

  async function remove() {
    setDeleting(true);
    setError(null);
    try {
      const response = await fetch(`/api/presets/${draft.id}`, { method: "DELETE" });
      const payload = (await response.json()) as PresetResponse;
      if (!response.ok) {
        setError(payload.error?.message || "The preset could not be deleted.");
        return;
      }
      applyResponse(payload);
      const nextId =
        payload.defaultPresetId ??
        payload.presets?.find((preset) => preset.builtIn)?.id ??
        payload.presets?.[0]?.id ??
        "";
      const next = payload.presets?.find((preset) => preset.id === nextId);
      if (next) {
        setSelectedId(next.id);
        setDraft(structuredClone(next));
      }
      toast.success("Preset deleted.");
    } catch {
      setError("Could not reach the app server.");
    } finally {
      setDeleting(false);
    }
  }

  async function makeDefault() {
    setError(null);
    try {
      const response = await fetch(`/api/presets/${draft.id}/default`, { method: "POST" });
      const payload = (await response.json()) as PresetResponse;
      if (!response.ok) {
        setError(payload.error?.message || "The default could not be changed.");
        return;
      }
      applyResponse(payload);
      toast.success(`“${draft.name}” is now the default for new books.`);
    } catch {
      setError("Could not reach the app server.");
    }
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto w-full max-w-6xl px-5 pb-16 pt-8 sm:px-8 lg:pt-10">
        <header className="flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="font-serif text-[2.4rem] leading-none tracking-[-0.03em]">Presets.</h1>
            <p className="mt-2.5 max-w-2xl text-[13px] leading-relaxed text-muted-foreground">
              Global system prompts and sampling parameters. New books copy a preset and the
              current default models at creation, then keep their own independent copy.
            </p>
          </div>
          <Button onClick={() => void createPreset("new")} disabled={creating}>
            {creating ? <Loader2 className="animate-spin" /> : <Plus />}
            New preset
          </Button>
        </header>

        <div className="mt-6 grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
          <aside>
            <div className="flex items-center justify-between border-b border-border pb-2">
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                Library
              </span>
              <span className="font-mono text-[10px] text-muted-foreground">
                {presets.length}
              </span>
            </div>
            <ul className="divide-y divide-border border-b border-border">
              {presets.map((preset) => {
                const active = preset.id === selectedId;
                return (
                  <li key={preset.id}>
                    <button
                      type="button"
                      onClick={() => selectPreset(preset.id)}
                      aria-current={active ? "true" : undefined}
                      className={cn(
                        "w-full px-2 py-3 text-left transition-colors hover:bg-white/[0.025]",
                        active && "bg-white/[0.035]",
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span
                          className={cn(
                            "text-[12.5px] font-medium",
                            active ? "text-[#f4c477]" : "text-foreground/90",
                          )}
                        >
                          {preset.name}
                        </span>
                        <span className="mt-1 flex shrink-0 gap-1">
                          {preset.builtIn ? <Badge variant="default">Base</Badge> : null}
                          {preset.id === defaultPresetId ? (
                            <Badge variant="amber">Default</Badge>
                          ) : null}
                        </span>
                      </div>
                      <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">
                        {preset.description || "No description."}
                      </p>
                    </button>
                  </li>
                );
              })}
            </ul>
            <p className="mt-3 text-[10.5px] leading-relaxed text-muted-foreground">
              The base preset cannot be deleted. It is the fallback for books without local
              settings.
            </p>
          </aside>

          <section className="min-w-0">
            <div className="rounded-lg border border-border bg-[#0d131a]">
              <div className="space-y-4 border-b border-border p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <Label htmlFor="preset-name">Preset name</Label>
                    <Input
                      id="preset-name"
                      value={draft.name}
                      onChange={(event) => updateDraft({ name: event.target.value })}
                      maxLength={80}
                      className="mt-1.5 h-10 font-serif text-[18px]"
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {isDefault ? (
                      <Badge variant="amber">
                        <Star className="size-2.5" />
                        Default
                      </Badge>
                    ) : (
                      <Button size="sm" variant="secondary" onClick={() => void makeDefault()}>
                        <Star />
                        Set as default
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => void createPreset("duplicate")}
                      disabled={creating}
                    >
                      <Copy />
                      Duplicate
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-muted-foreground hover:text-[#f2937f]"
                          disabled={isBase || deleting}
                          title={isBase ? "The base fallback cannot be deleted." : undefined}
                        >
                          <Trash2 />
                          Delete
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete “{draft.name}”?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Existing books keep their copied prompts and parameters. Only the
                            global preset is removed.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Keep it</AlertDialogCancel>
                          <AlertDialogAction onClick={() => void remove()} disabled={deleting}>
                            {deleting ? "Deleting…" : "Delete preset"}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
                <div>
                  <Label htmlFor="preset-description">Description</Label>
                  <Textarea
                    id="preset-description"
                    value={draft.description}
                    onChange={(event) => updateDraft({ description: event.target.value })}
                    className="mt-1.5 min-h-16 text-[12px]"
                    maxLength={500}
                    placeholder="What is this preset for?"
                  />
                </div>
              </div>

              <div className="p-5">
                <Tabs value={activeRole} onValueChange={(value) => setActiveRole(value as AIRole)}>
                  <TabsList>
                    {AI_ROLES.map((role) => (
                      <TabsTrigger key={role} value={role}>
                        {ROLE_LABELS[role]}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </Tabs>

                <div className="mt-5">
                  <RoleSettingsEditor
                    role={activeRole}
                    value={draft.roles[activeRole]}
                    onChange={(value) => updateRole(activeRole, value)}
                  />
                </div>
              </div>

              <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-3 rounded-b-lg border-t border-border bg-[#0d131a] px-5 py-3.5">
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                  {dirty ? (
                    <>
                      <span className="size-1.5 rounded-full bg-primary" />
                      Unsaved changes
                    </>
                  ) : (
                    <>
                      <Check className="size-3.5 text-[#86bd93]" />
                      Saved
                    </>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDraft(structuredClone(selected))}
                    disabled={!dirty || saving}
                  >
                    <Undo2 />
                    Discard
                  </Button>
                  <Button onClick={() => void save()} disabled={!dirty || saving || !draft.name.trim()}>
                    {saving ? <Loader2 className="animate-spin" /> : <Save />}
                    {saving ? "Saving…" : "Save preset"}
                  </Button>
                </div>
              </div>
            </div>

            {error ? (
              <p className="mt-3 rounded-md border border-[#5a2c25] bg-[#241411] p-3 text-[12px] text-[#f2937f]">
                {error}
              </p>
            ) : null}
          </section>
        </div>
      </div>
    </div>
  );
}
