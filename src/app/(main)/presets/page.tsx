import { getConfig } from "@/lib/storage/config";
import { createDefaultPreset } from "@/lib/presets/defaults";
import { PresetManager } from "@/components/presets/preset-manager";

export const dynamic = "force-dynamic";

export default async function PresetsPage() {
  const config = await getConfig();
  const presets = config?.presets ?? [createDefaultPreset()];
  const defaultPresetId = config?.defaultPresetId ?? presets[0].id;

  return (
    <PresetManager
      initialPresets={presets}
      initialDefaultPresetId={defaultPresetId}
    />
  );
}
