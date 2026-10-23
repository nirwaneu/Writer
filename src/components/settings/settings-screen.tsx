"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Image as ImageIcon,
  Check,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Server,
  Trash2,
  Zap,
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
import { StatusDot } from "@/components/status-dot";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ModelCombobox } from "@/components/models/model-combobox";
import {
  AI_ROLES,
  CORE_ROLES,
  ROLE_LABELS,
  type AIRole,
} from "@/lib/presets/constants";
import { useAvailableModels } from "@/lib/use-available-models";
import type { ModelRoles, PublicAppConfig, PublicProvider } from "@/lib/schemas";

type ProvidersResponse = {
  providers?: PublicProvider[];
  models?: ModelRoles;
  configured?: boolean;
  error?: { message?: string };
};

type FormState = {
  name: string;
  baseUrl: string;
  apiKey: string;
};

const EMPTY_FORM: FormState = { name: "", baseUrl: "", apiKey: "" };
const EMPTY_MODELS: ModelRoles = {
  planner: "",
  executor: "",
  summarizer: "",
  imagePrompter: "",
};

export function SettingsScreen({
  mode,
  initialConfig,
}: {
  mode: "setup" | "settings";
  initialConfig: PublicAppConfig | null;
}) {
  const router = useRouter();
  const [providers, setProviders] = useState<PublicProvider[]>(
    initialConfig?.providers ?? [],
  );
  const [models, setModels] = useState<ModelRoles>(
    initialConfig?.models ?? EMPTY_MODELS,
  );
  const [activeTab, setActiveTab] = useState<"providers" | "models">(
    mode === "setup" && !initialConfig?.providers.length ? "providers" : "models",
  );
  const [editingId, setEditingId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [savingModels, setSavingModels] = useState(false);
  const [modelsError, setModelsError] = useState<string | null>(null);
  const [savedModels, setSavedModels] = useState<ModelRoles>(models);
  const [imageProvider, setImageProvider] = useState<PublicProvider | null>(null);
  const [imageDraft, setImageDraft] = useState<string[]>([]);
  const [customImageModel, setCustomImageModel] = useState("");
  const [savingImageModels, setSavingImageModels] = useState(false);
  const [imageModelsError, setImageModelsError] = useState<string | null>(null);

  const { groups, options, loading, error, refresh } = useAvailableModels();

  const editing = useMemo(
    () => providers.find((provider) => provider.id === editingId) ?? null,
    [providers, editingId],
  );
  const imageProviderGroup = imageProvider
    ? groups.find((group) => group.providerId === imageProvider.id)
    : undefined;
  const imageModelChoices = imageProvider
    ? Array.from(
        new Set([
          ...(imageProviderGroup?.models ?? []),
          ...imageProvider.imageModels,
          ...imageDraft,
        ]),
      ).sort()
    : [];

  const modelsDirty =
    models.planner !== savedModels.planner ||
    models.executor !== savedModels.executor ||
    models.summarizer !== savedModels.summarizer ||
    models.imagePrompter !== savedModels.imagePrompter;
  const modelsComplete = CORE_ROLES.every((role) => Boolean(models[role].trim()));
  const configured = providers.length > 0 && modelsComplete;

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setDialogOpen(true);
  }

  function openEdit(provider: PublicProvider) {
    setEditingId(provider.id);
    setForm({ name: provider.name, baseUrl: provider.baseUrl, apiKey: "" });
    setFormError(null);
    setDialogOpen(true);
  }

  function openImageModels(provider: PublicProvider) {
    setImageProvider(provider);
    setImageDraft(provider.imageModels);
    setCustomImageModel("");
    setImageModelsError(null);
  }

  function toggleImageModel(model: string) {
    setImageDraft((current) =>
      current.includes(model)
        ? current.filter((item) => item !== model)
        : [...current, model],
    );
  }

  function addCustomImageModel() {
    const value = customImageModel.trim();
    if (!value) return;
    setImageDraft((current) => (current.includes(value) ? current : [...current, value]));
    setCustomImageModel("");
  }

  async function saveImageModels() {
    if (!imageProvider) return;
    setSavingImageModels(true);
    setImageModelsError(null);
    try {
      const response = await fetch(`/api/providers/${imageProvider.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageModels: imageDraft }),
      });
      const payload = (await response.json()) as ProvidersResponse;
      if (!response.ok) {
        setImageModelsError(payload.error?.message || "Image models could not be saved.");
        return;
      }
      applyProviders(payload);
      void refresh();
      setImageProvider(null);
      toast.success("Image models updated.");
    } catch {
      setImageModelsError("Could not reach the app server.");
    } finally {
      setSavingImageModels(false);
    }
  }

  function applyProviders(payload: ProvidersResponse) {
    if (payload.providers) setProviders(payload.providers);
    if (payload.models) {
      setModels(payload.models);
      setSavedModels(payload.models);
    }
  }

  async function submitProvider() {
    if (!form.name.trim() || !form.baseUrl.trim()) {
      setFormError("A name and a base URL are required.");
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      const response = await fetch(
        editing ? `/api/providers/${editing.id}` : "/api/providers",
        {
          method: editing ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: form.name.trim(),
            baseUrl: form.baseUrl.trim(),
            ...(form.apiKey.trim() ? { apiKey: form.apiKey.trim() } : {}),
          }),
        },
      );
      const payload = (await response.json()) as ProvidersResponse;
      if (!response.ok) {
        setFormError(payload.error?.message || "The provider could not be saved.");
        return;
      }
      applyProviders(payload);
      setDialogOpen(false);
      void refresh();
      toast.success(editing ? "Provider updated." : "Provider connected.");
      if (!editing && providers.length === 0) setActiveTab("models");
    } catch {
      setFormError("Could not reach the app server.");
    } finally {
      setSubmitting(false);
    }
  }

  async function testProvider(provider: PublicProvider) {
    setTestingId(provider.id);
    try {
      const response = await fetch("/api/providers/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          baseUrl: provider.baseUrl,
          providerId: provider.id,
        }),
      });
      const payload = (await response.json()) as {
        ok?: boolean;
        latencyMs?: number;
        detail?: string;
        error?: { message?: string };
      };
      if (!response.ok) {
        toast.error(payload.error?.message || "The connection test failed.");
        return;
      }
      setProviders((current) =>
        current.map((item) =>
          item.id === provider.id
            ? {
                ...item,
                connection: {
                  ok: Boolean(payload.ok),
                  checkedAt: new Date().toISOString(),
                  latencyMs: payload.latencyMs,
                  detail: payload.detail,
                },
              }
            : item,
        ),
      );
      if (payload.ok) {
        toast.success(payload.detail || "Connected.");
        void refresh();
      } else {
        toast.error(payload.detail || "The provider did not respond.");
      }
    } catch {
      toast.error("Could not reach the app server.");
    } finally {
      setTestingId(null);
    }
  }

  async function deleteProvider(provider: PublicProvider) {
    setDeletingId(provider.id);
    try {
      const response = await fetch(`/api/providers/${provider.id}`, {
        method: "DELETE",
      });
      const payload = (await response.json()) as ProvidersResponse;
      if (!response.ok) {
        toast.error(payload.error?.message || "The provider could not be removed.");
        return;
      }
      applyProviders(payload);
      void refresh();
      toast.success("Provider removed.");
    } catch {
      toast.error("Could not reach the app server.");
    } finally {
      setDeletingId(null);
    }
  }

  async function saveModels() {
    if (!modelsComplete) {
      setModelsError("Choose a model for Planner, Executor, and Summarizer.");
      return;
    }
    setSavingModels(true);
    setModelsError(null);
    try {
      const response = await fetch("/api/config/models", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ models }),
      });
      const payload = (await response.json()) as {
        configured?: boolean;
        error?: { message?: string };
      };
      if (!response.ok) {
        setModelsError(payload.error?.message || "The models could not be saved.");
        return;
      }
      setSavedModels(models);
      toast.success("Default models saved.");
      if (mode === "setup") {
        router.replace("/");
        router.refresh();
      } else {
        router.refresh();
      }
    } catch {
      setModelsError("Could not reach the app server.");
    } finally {
      setSavingModels(false);
    }
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto w-full max-w-5xl px-5 pb-16 pt-8 sm:px-8 lg:pt-10">
        <header className="border-b border-border pb-6">
          <h1 className="font-serif text-[2.4rem] leading-none tracking-[-0.03em]">
            {mode === "setup" ? "Connect." : "Settings."}
          </h1>
          <p className="mt-2.5 max-w-2xl text-[13px] leading-relaxed text-muted-foreground">
            {mode === "setup"
              ? "Add at least one OpenAI-compatible provider, then choose a model for each role. Models can come from different providers."
              : "Provider connections and the default models for new books. Each book keeps its own copy once created."}
          </p>
        </header>

        <div className="mt-6">
          <Tabs
            value={activeTab}
            onValueChange={(value) => setActiveTab(value as "providers" | "models")}
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <TabsList>
                <TabsTrigger value="providers">
                  <Server />
                  Providers
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {providers.length}
                  </span>
                </TabsTrigger>
                <TabsTrigger value="models">
                  <Zap />
                  Models
                </TabsTrigger>
              </TabsList>
              <div className="flex items-center gap-2">
                <Badge variant={configured ? "success" : "amber"}>
                  <StatusDot tone={configured ? "success" : "amber"} />
                  {configured ? "Ready" : "Needs setup"}
                </Badge>
                {activeTab === "providers" ? (
                  <Button size="sm" onClick={openCreate}>
                    <Plus />
                    Add provider
                  </Button>
                ) : null}
              </div>
            </div>

            <TabsContent value="providers">
              <div className="overflow-hidden rounded-lg border border-border bg-[#0d131a]">
                {providers.length ? (
                  <ul className="divide-y divide-border">
                    {providers.map((provider) => (
                      <li key={provider.id} className="p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <StatusDot
                                tone={provider.connection.ok ? "success" : "muted"}
                              />
                              <span className="text-[13px] font-medium">
                                {provider.name}
                              </span>
                              <Badge
                                variant={provider.connection.ok ? "success" : "default"}
                              >
                                {provider.connection.ok ? "Connected" : "Untested"}
                              </Badge>
                              <span className="font-mono text-[10px] text-muted-foreground">
                                {provider.apiKeyHint ?? "no key"}
                              </span>
                            </div>
                            <p className="mt-1.5 truncate font-mono text-[11px] text-muted-foreground">
                              {provider.baseUrl}
                            </p>
                            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                              {provider.connection.detail ||
                                "Test the connection to list available models."}
                            </p>
                          </div>

                          <div className="flex items-center gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => void testProvider(provider)}
                              disabled={testingId === provider.id}
                            >
                              {testingId === provider.id ? (
                                <Loader2 className="animate-spin" />
                              ) : (
                                <RefreshCw />
                              )}
                              Test
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => openImageModels(provider)}
                            >
                              <ImageIcon />
                              Image models
                              <span className="font-mono text-[10px] text-muted-foreground">
                                {provider.imageModels.length}
                              </span>
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => openEdit(provider)}
                            >
                              <Pencil />
                              Edit
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-muted-foreground hover:text-[#f2937f]"
                                  disabled={providers.length <= 1 || deletingId === provider.id}
                                  title={
                                    providers.length <= 1
                                      ? "Keep at least one provider."
                                      : undefined
                                  }
                                >
                                  <Trash2 />
                                  Remove
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>
                                    Remove “{provider.name}”?
                                  </AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Models routed to this provider will stop working. Providers
                                    used by the default models or any book cannot be removed
                                    until those models are reassigned.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Keep it</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => void deleteProvider(provider)}
                                    disabled={deletingId === provider.id}
                                  >
                                    {deletingId === provider.id
                                      ? "Removing…"
                                      : "Remove provider"}
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
                    <span className="flex size-10 items-center justify-center rounded-full border border-border bg-[#0c1218]">
                      <Server className="size-4 text-muted-foreground" />
                    </span>
                    <div>
                      <p className="text-[13px] font-medium">No providers connected.</p>
                      <p className="mt-1 max-w-sm text-[11.5px] leading-relaxed text-muted-foreground">
                        Add an OpenAI-compatible endpoint and API key. The connection is
                        tested before it is saved.
                      </p>
                    </div>
                    <Button size="sm" onClick={openCreate}>
                      <Plus />
                      Add provider
                    </Button>
                  </div>
                )}
              </div>
              <p className="mt-3 text-[10.5px] leading-relaxed text-muted-foreground">
                Requests are routed to the provider that owns the selected model. Multiple
                providers can be used at the same time for different roles.
              </p>
            </TabsContent>

            <TabsContent value="models">
              <div className="rounded-lg border border-border bg-[#0d131a]">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-5 py-3.5">
                  <div>
                    <h2 className="text-[13px] font-medium">Default models</h2>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      Copied into each new book when it is created.
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => void refresh()}
                    disabled={loading || !providers.length}
                  >
                    {loading ? <Loader2 className="animate-spin" /> : <RefreshCw />}
                    Refresh models
                  </Button>
                </div>

                <div className="divide-y divide-border">
                  {AI_ROLES.map((role) => (
                    <div
                      key={role}
                      className="grid gap-3 px-5 py-4 sm:grid-cols-[160px_minmax(0,1fr)] sm:items-center"
                    >
                      <div>
                        <Label htmlFor={`default-model-${role}`}>
                          {ROLE_LABELS[role]}
                          {role === "imagePrompter" ? " (optional)" : ""}
                        </Label>
                        <p className="mt-1 text-[10.5px] leading-relaxed text-muted-foreground">
                          {roleDescription(role)}
                        </p>
                      </div>
                      <ModelCombobox
                        id={`default-model-${role}`}
                        value={models[role]}
                        onChange={(value) =>
                          setModels((current) => ({ ...current, [role]: value }))
                        }
                        groups={groups}
                        options={options}
                        loading={loading}
                        error={role === "planner" ? error : null}
                        disabled={!providers.length}
                        placeholder={
                          providers.length
                            ? "Choose a model?"
                            : "Add a provider first"
                        }
                      />
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-3.5">
                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                    {modelsDirty ? (
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
                  <Button
                    onClick={() => void saveModels()}
                    disabled={savingModels || !modelsDirty || !modelsComplete}
                  >
                    {savingModels ? <Loader2 className="animate-spin" /> : <Save />}
                    {savingModels ? "Saving…" : "Save models"}
                  </Button>
                </div>
              </div>

              {modelsError ? (
                <p className="mt-3 rounded-md border border-[#5a2c25] bg-[#241411] p-3 text-[12px] text-[#f2937f]">
                  {modelsError}
                </p>
              ) : null}

              {!providers.length ? (
                <p className="mt-3 rounded-md border border-border bg-[#0c1218] p-3 text-[11.5px] leading-relaxed text-muted-foreground">
                  Add a provider connection before choosing models.
                </p>
              ) : null}
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editing ? `Edit ${editing.name}` : "Add provider"}
            </DialogTitle>
            <DialogDescription>
              Any OpenAI-compatible endpoint. The key is stored locally in{" "}
              <span className="font-mono text-[11px]">vibedraft.db</span>.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="provider-name">Name</Label>
              <Input
                id="provider-name"
                value={form.name}
                onChange={(event) =>
                  setForm((current) => ({ ...current, name: event.target.value }))
                }
                placeholder="e.g. NanoGPT"
                maxLength={80}
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="provider-base-url">Base URL</Label>
              <Input
                id="provider-base-url"
                value={form.baseUrl}
                onChange={(event) =>
                  setForm((current) => ({ ...current, baseUrl: event.target.value }))
                }
                placeholder="https://api.example.com/v1"
                spellCheck={false}
                maxLength={2_000}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="provider-api-key">API key</Label>
              <Input
                id="provider-api-key"
                type="password"
                value={form.apiKey}
                onChange={(event) =>
                  setForm((current) => ({ ...current, apiKey: event.target.value }))
                }
                placeholder={editing?.hasApiKey ? "Leave blank to keep the saved key" : "Optional"}
                autoComplete="off"
                spellCheck={false}
                maxLength={4_000}
              />
            </div>
            {formError ? (
              <p className="rounded-md border border-[#5a2c25] bg-[#241411] p-2.5 text-[11.5px] leading-relaxed text-[#f2937f]">
                {formError}
              </p>
            ) : null}
          </div>

          <DialogFooter>
            <Button
              variant="secondary"
              onClick={() => setDialogOpen(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button onClick={() => void submitProvider()} disabled={submitting}>
              {submitting ? <Loader2 className="animate-spin" /> : <Check />}
              {submitting
                ? "Testing connection…"
                : editing
                  ? "Save and test"
                  : "Connect provider"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(imageProvider)} onOpenChange={(open) => !open && setImageProvider(null)}>
        <DialogContent className="max-h-[86vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Image models · {imageProvider?.name}</DialogTitle>
            <DialogDescription>
              Flag the models that generate images. Illustration pages only show flagged
              models for this provider. If none are flagged, all models are shown.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {imageProviderGroup?.error ? (
              <p className="rounded-md border border-[#5a2c25] bg-[#241411] p-2.5 text-[11.5px] leading-relaxed text-[#f2937f]">
                {imageProviderGroup.error}
              </p>
            ) : null}

            <div className="max-h-[40vh] space-y-1 overflow-y-auto rounded-md border border-border bg-[#0c1218] p-2">
              {imageModelChoices.length ? (
                imageModelChoices.map((model) => (
                  <label
                    key={model}
                    className="flex cursor-pointer items-center gap-2.5 rounded px-2 py-1.5 text-[12px] hover:bg-white/[0.04]"
                  >
                    <input
                      type="checkbox"
                      checked={imageDraft.includes(model)}
                      onChange={() => toggleImageModel(model)}
                      className="size-3.5 accent-[#f2a93b]"
                    />
                    <span className="font-mono text-[11px]">{model}</span>
                  </label>
                ))
              ) : (
                <p className="px-2 py-3 text-[11.5px] text-muted-foreground">
                  No models listed. Add an image model ID below.
                </p>
              )}
            </div>

            <div className="flex items-end gap-2">
              <div className="flex-1 space-y-1.5">
                <Label htmlFor="custom-image-model">Add model ID</Label>
                <Input
                  id="custom-image-model"
                  value={customImageModel}
                  onChange={(event) => setCustomImageModel(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      addCustomImageModel();
                    }
                  }}
                  placeholder="e.g. flux-1.1-pro"
                  spellCheck={false}
                  maxLength={200}
                />
              </div>
              <Button type="button" variant="secondary" onClick={addCustomImageModel}>
                Add
              </Button>
            </div>

            {imageDraft.length ? (
              <p className="text-[10.5px] leading-relaxed text-muted-foreground">
                Flagged: <span className="font-mono">{imageDraft.join(", ")}</span>
              </p>
            ) : null}

            {imageModelsError ? (
              <p className="rounded-md border border-[#5a2c25] bg-[#241411] p-2.5 text-[11.5px] leading-relaxed text-[#f2937f]">
                {imageModelsError}
              </p>
            ) : null}
          </div>

          <DialogFooter>
            <Button
              variant="secondary"
              onClick={() => setImageProvider(null)}
              disabled={savingImageModels}
            >
              Cancel
            </Button>
            <Button onClick={() => void saveImageModels()} disabled={savingImageModels}>
              {savingImageModels ? <Loader2 className="animate-spin" /> : <Check />}
              {savingImageModels ? "Saving…" : "Save image models"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function roleDescription(role: AIRole): string {
  if (role === "planner") return "Plans chapters in the rail.";
  if (role === "executor") return "Drafts the chapter prose.";
  if (role === "imagePrompter") return "Writes image prompts for illustrations and covers.";
  return "Maintains story continuity.";
}
