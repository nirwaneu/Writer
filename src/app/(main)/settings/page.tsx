import { getConfig, toPublicConfig } from "@/lib/storage/config";
import { SettingsScreen } from "@/components/settings/settings-screen";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const config = await getConfig();
  return <SettingsScreen mode="settings" initialConfig={toPublicConfig(config)} />;
}
