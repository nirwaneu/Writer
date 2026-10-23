import { getDraft } from "@/lib/storage/novels";
import { readDraftChat } from "@/lib/storage/chats";
import { getConfig } from "@/lib/storage/config";
import { createDefaultPreset } from "@/lib/presets/defaults";
import { PremiseStudio } from "@/components/premise/premise-studio";
import { NewProjectStart } from "@/components/premise/new-project-start";
import type { ChatMessage, Outline } from "@/lib/schemas";

export const dynamic = "force-dynamic";

export default async function NewBookPage({
  searchParams,
}: {
  searchParams: Promise<{ draft?: string }>;
}) {
  const params = await searchParams;
  const config = await getConfig();
  const presets = config?.presets ?? [createDefaultPreset()];
  const defaultPresetId = config?.defaultPresetId ?? presets[0].id;

  if (!params.draft) {
    return (
      <NewProjectStart presets={presets} defaultPresetId={defaultPresetId} />
    );
  }

  let outline: Outline | null = null;
  let messages: ChatMessage[] = [];
  try {
    outline = await getDraft(params.draft);
    const chat = await readDraftChat(params.draft, "premise");
    messages = chat.messages;
  } catch {
    outline = null;
  }

  if (!outline) {
    return (
      <NewProjectStart
        message="That draft is no longer available. Start a new conversation."
        presets={presets}
        defaultPresetId={defaultPresetId}
      />
    );
  }

  return (
    <PremiseStudio
      draftId={params.draft}
      outline={outline}
      initialMessages={messages}
    />
  );
}
