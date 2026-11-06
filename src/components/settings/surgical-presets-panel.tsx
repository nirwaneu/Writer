"use client";

import { useEffect, useState } from "react";
import {
  Check,
  ChevronDown,
  ChevronUp,
  Loader2,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { SurgicalPreset } from "@/lib/schemas";

type PresetsResponse = {
  presets?: SurgicalPreset[];
  preset?: SurgicalPreset;
  error?: { message?: string };
};

type PresetForm = {
  label: string;
  icon: string;
  instruction: string;
  active: boolean;
};

const EMPTY_FORM: PresetForm = {
  label: "",
  icon: "✨",
  instruction: "",
  active: true,
};

export function SurgicalPresetsPanel() {
  const [presets, setPresets] = useState<SurgicalPreset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<SurgicalPreset | null>(null);
  const [form, setForm] = useState<PresetForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch("/api/surgical-presets", { cache: "no-store" });
        const payload = (await response.json().catch(() => null)) as PresetsResponse | null;
        if (cancelled) return;
        if (!response.ok || !payload?.presets) {
          setError(payload?.error?.message || "Surgical presets could not be loaded.");
          setLoading(false);
          return;
        }
        setPresets(payload.presets);
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

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setError(null);
    setDialogOpen(true);
  }

  function openEdit(preset: SurgicalPreset) {
    setEditing(preset);
    setForm({
      label: preset.label,
      icon: preset.icon,
      instruction: preset.instruction,
      active: preset.active,
    });
    setError(null);
    setDialogOpen(true);
  }

  async function submit() {
    if (!form.label.trim() || !form.instruction.trim()) {
      setError("A label and an instruction are required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(
        editing ? `/api/surgical-presets/${editing.id}` : "/api/surgical-presets",
        {
          method: editing ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            label: form.label.trim(),
            icon: form.icon.trim(),
            instruction: form.instruction.trim(),
            active: form.active,
          }),
        },
      );
      const payload = (await response.json().catch(() => null)) as PresetsResponse | null;
      if (!response.ok || !payload?.presets) {
        setError(payload?.error?.message || "The preset could not be saved.");
        return;
      }
      setPresets(payload.presets);
      setDialogOpen(false);
      toast.success(editing ? "Preset updated." : "Preset added.");
    } catch {
      setError("Could not reach the app server.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(preset: SurgicalPreset) {
    try {
      const response = await fetch(`/api/surgical-presets/${preset.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !preset.active }),
      });
      const payload = (await response.json().catch(() => null)) as PresetsResponse | null;
      if (!response.ok || !payload?.presets) {
        toast.error(payload?.error?.message || "The preset could not be updated.");
        return;
      }
      setPresets(payload.presets);
    } catch {
      toast.error("Could not reach the app server.");
    }
  }

  async function move(index: number, direction: -1 | 1) {
    const target = presets[index + direction];
    if (!target) return;
    const next = [...presets];
    next[index + direction] = next[index];
    next[index] = target;
    setPresets(next);
    try {
      const response = await fetch("/api/surgical-presets/reorder", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: next.map((preset) => preset.id) }),
      });
      const payload = (await response.json().catch(() => null)) as PresetsResponse | null;
      if (!response.ok || !payload?.presets) {
        toast.error(payload?.error?.message || "The order could not be saved.");
        return;
      }
      setPresets(payload.presets);
    } catch {
      toast.error("Could not reach the app server.");
    }
  }

  async function remove(preset: SurgicalPreset) {
    setDeletingId(preset.id);
    try {
      const response = await fetch(`/api/surgical-presets/${preset.id}`, {
        method: "DELETE",
      });
      const payload = (await response.json().catch(() => null)) as PresetsResponse | null;
      if (!response.ok || !payload?.presets) {
        toast.error(payload?.error?.message || "The preset could not be removed.");
        return;
      }
      setPresets(payload.presets);
      toast.success("Preset removed.");
    } catch {
      toast.error("Could not reach the app server.");
    } finally {
      setDeletingId(null);
    }
  }

  async function reset() {
    setResetting(true);
    try {
      const response = await fetch("/api/surgical-presets/reset", { method: "POST" });
      const payload = (await response.json().catch(() => null)) as PresetsResponse | null;
      if (!response.ok || !payload?.presets) {
        toast.error(payload?.error?.message || "Defaults could not be restored.");
        return;
      }
      setPresets(payload.presets);
      toast.success("Default surgical presets restored.");
    } catch {
      toast.error("Could not reach the app server.");
    } finally {
      setResetting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-border bg-[#0d131a] px-5 py-10 text-[12px] text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading surgical presets…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-lg border border-border bg-[#0d131a]">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-5 py-3.5">
          <div>
            <h2 className="text-[13px] font-medium">Surgical Polish presets</h2>
            <p className="mt-0.5 max-w-2xl text-[11px] leading-relaxed text-muted-foreground">
              Inline rewrite actions shown when you select text in the Executor. Order here controls
              how they appear in the floating bar.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="sm" disabled={resetting}>
                  <RotateCcw />
                  Reset defaults
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Restore default presets?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This removes every custom preset and restores the four standard presets:
                    Show, Don&apos;t Tell, Tighten, Sensory Details, and Natural Dialog.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Keep mine</AlertDialogCancel>
                  <AlertDialogAction onClick={() => void reset()} disabled={resetting}>
                    {resetting ? "Restoring…" : "Restore defaults"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <Button size="sm" onClick={openCreate}>
              <Plus />
              Add preset
            </Button>
          </div>
        </div>

        {error ? (
          <p className="mx-5 mt-4 rounded-md border border-[#5a2c25] bg-[#241411] p-2.5 text-[11.5px] leading-relaxed text-[#f2937f]">
            {error}
          </p>
        ) : null}

        {presets.length ? (
          <ul className="divide-y divide-border">
            {presets.map((preset, index) => (
              <li key={preset.id} className="flex flex-wrap items-start gap-3 px-5 py-3.5">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-md border border-border bg-[#0c1218] text-[18px]">
                  {preset.icon || "✨"}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[13px] font-medium">{preset.label}</span>
                    <Badge variant={preset.active ? "success" : "default"}>
                      {preset.active ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                  <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">
                    {preset.instruction}
                  </p>
                </div>
                <div className="flex items-center gap-0.5">
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label="Move preset up"
                    disabled={index === 0}
                    onClick={() => void move(index, -1)}
                  >
                    <ChevronUp />
                  </Button>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label="Move preset down"
                    disabled={index === presets.length - 1}
                    onClick={() => void move(index, 1)}
                  >
                    <ChevronDown />
                  </Button>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label={preset.active ? "Deactivate preset" : "Activate preset"}
                    title={preset.active ? "Deactivate" : "Activate"}
                    onClick={() => void toggleActive(preset)}
                  >
                    {preset.active ? <X /> : <Check />}
                  </Button>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label="Edit preset"
                    onClick={() => openEdit(preset)}
                  >
                    <Pencil />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        aria-label="Delete preset"
                        className="hover:text-[#f2937f]"
                        disabled={deletingId === preset.id}
                      >
                        <Trash2 />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete “{preset.label}”?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This preset will disappear from the selection bar immediately.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Keep it</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => void remove(preset)}
                          disabled={deletingId === preset.id}
                        >
                          {deletingId === preset.id ? "Deleting…" : "Delete preset"}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="px-5 py-10 text-center text-[12px] text-muted-foreground">
            No surgical presets yet. Add one or restore the defaults.
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit preset" : "Add surgical preset"}</DialogTitle>
            <DialogDescription>
              The floating bar shows the label and icon. The instruction is sent to the model.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-[64px_minmax(0,1fr)] gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="surgical-icon">Icon</Label>
                <Input
                  id="surgical-icon"
                  value={form.icon}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, icon: event.target.value }))
                  }
                  maxLength={20}
                  placeholder="✨"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="surgical-label">Label</Label>
                <Input
                  id="surgical-label"
                  value={form.label}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, label: event.target.value }))
                  }
                  maxLength={20}
                  placeholder="Make it Dark"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="surgical-instruction">Instruction</Label>
              <Textarea
                id="surgical-instruction"
                value={form.instruction}
                onChange={(event) =>
                  setForm((current) => ({ ...current, instruction: event.target.value }))
                }
                className="min-h-40 resize-y text-[12.5px] leading-relaxed"
                placeholder="Tell the model exactly how to rewrite the selected passage."
              />
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-[12px] text-muted-foreground">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(event) =>
                  setForm((current) => ({ ...current, active: event.target.checked }))
                }
                className="size-3.5 accent-[#f2a93b]"
              />
              Show this preset in the selection bar
            </label>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={() => void submit()} disabled={saving}>
              {saving ? <Loader2 className="animate-spin" /> : <Check />}
              {saving ? "Saving…" : editing ? "Save preset" : "Add preset"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}