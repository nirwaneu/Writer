import { listArchivedNovels, listNovels } from "@/lib/storage/novels";
import { getConfig } from "@/lib/storage/config";
import { createDefaultPreset } from "@/lib/presets/defaults";
import { LibraryView } from "@/components/library/library-view";

export const dynamic = "force-dynamic";

export default async function LibraryPage() {
  const [novels, archivedNovels, config] = await Promise.all([
    listNovels(),
    listArchivedNovels(),
    getConfig(),
  ]);
  const presets = config?.presets ?? [createDefaultPreset()];

  return (
    <LibraryView
      novels={novels}
      archivedNovels={archivedNovels}
      presets={presets}
      defaultPresetId={config?.defaultPresetId ?? presets[0].id}
      globalModels={config?.models ?? null}
      providers={config?.providers ?? []}
    />
  );
}
