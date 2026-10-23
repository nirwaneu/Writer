export async function createDraftRequest(presetId?: string): Promise<string> {
  const response = await fetch("/api/drafts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(presetId ? { presetId } : {}),
  });
  const payload = (await response.json().catch(() => ({}))) as {
    draft?: { id?: string };
    error?: { message?: string };
  };
  if (!response.ok || !payload.draft?.id) {
    throw new Error(payload.error?.message || "Could not start a new book.");
  }
  return payload.draft.id;
}
