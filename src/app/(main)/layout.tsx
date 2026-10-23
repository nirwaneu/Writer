import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { getConfig, isConfigured } from "@/lib/storage/config";
import { AppShell } from "@/components/app-shell";
import { modelDisplayLabel } from "@/lib/ai/routing";

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  const config = await getConfig();

  if (!isConfigured(config)) {
    redirect("/setup");
  }

  return (
    <AppShell
      username={session.username}
      modelsReady
      modelLabel={modelDisplayLabel(config.providers, config.models.executor)}
    >
      {children}
    </AppShell>
  );
}
