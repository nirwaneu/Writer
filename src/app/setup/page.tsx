import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { getConfig, isConfigured, toPublicConfig } from "@/lib/storage/config";
import { SettingsScreen } from "@/components/settings/settings-screen";

export const dynamic = "force-dynamic";

export default async function SetupPage() {
  await requireSession();
  const config = await getConfig();
  if (isConfigured(config)) redirect("/");
  return <SettingsScreen mode="setup" initialConfig={toPublicConfig(config)} />;
}
