import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { getAuthEnv } from "@/lib/auth/credentials";
import { LoginScreen } from "@/components/auth/login-screen";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const session = await getSession();
  if (session) redirect("/");

  const params = await searchParams;
  const next =
    params.next && params.next.startsWith("/") && !params.next.startsWith("//")
      ? params.next
      : "/";
  const env = getAuthEnv();

  return <LoginScreen nextPath={next} configured={env.configured} />;
}
