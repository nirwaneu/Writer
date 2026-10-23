"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";
import { BookOpen, LogOut, Settings2, ShieldCheck, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import { Wordmark } from "@/components/wordmark";
import { StatusDot } from "@/components/status-dot";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export function AppShell({
  children,
  username,
  modelsReady,
  modelLabel,
}: {
  children: React.ReactNode;
  username: string;
  modelsReady: boolean;
  modelLabel: string | null;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    startTransition(() => {
      router.replace("/login");
      router.refresh();
    });
    toast.success("Signed out.");
  }

  const nav = [
    { href: "/", label: "Library", icon: BookOpen, match: (path: string) => path === "/" },
    {
      href: "/presets",
      label: "Presets",
      icon: SlidersHorizontal,
      match: (path: string) => path.startsWith("/presets"),
    },
    {
      href: "/settings",
      label: "Settings",
      icon: Settings2,
      match: (path: string) => path.startsWith("/settings") || path.startsWith("/setup"),
    },
  ];

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <header className="z-30 flex h-14 shrink-0 items-center justify-between border-b border-border bg-[#0b0f14]/95 px-4 sm:px-6">
        <div className="flex items-center gap-2 sm:gap-7">
          <Link href="/" className="rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <Wordmark />
          </Link>
          <nav className="flex items-center gap-1" aria-label="Primary">
            {nav.map((item) => {
              const active = item.match(pathname);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative rounded-[5px] px-1.5 py-1.5 text-[12px] font-medium transition-colors sm:px-2.5 sm:text-[13px]",
                    active
                      ? "text-foreground"
                      : "text-muted-foreground hover:bg-white/[0.04] hover:text-foreground",
                  )}
                >
                  {item.label}
                  {active ? (
                    <span className="absolute inset-x-1.5 -bottom-[11px] h-px bg-primary sm:inset-x-2.5" />
                  ) : null}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href={modelsReady ? "/settings" : "/setup"}
            className="group hidden items-center gap-2 rounded-[5px] border border-transparent px-2 py-1.5 text-[11px] text-muted-foreground transition-colors hover:border-border hover:bg-white/[0.03] hover:text-foreground sm:flex"
            title={modelLabel ?? "Model connection"}
          >
            <StatusDot tone={modelsReady ? "success" : "danger"} pulse={!modelsReady} />
            <span className="hidden max-w-40 truncate sm:inline">
              {modelsReady ? (modelLabel ? `Default ? ${modelLabel}` : "Models ready") : "Connect models"}
            </span>
          </Link>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-2 px-1.5 sm:px-2">
                <span className="flex size-6 items-center justify-center rounded-full border border-border bg-secondary font-mono text-[10px] uppercase text-muted-foreground">
                  {username.slice(0, 2)}
                </span>
                <span className="hidden max-w-28 truncate text-[12px] text-muted-foreground md:inline">
                  {username}
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuLabel className="flex items-center gap-2">
                <ShieldCheck className="size-3.5 text-[#86bd93]" />
                Single-user session
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/settings">
                  <Settings2 />
                  Model settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={logout} disabled={pending}>
                <LogOut />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>
      <main className="min-h-0 flex-1 overflow-hidden">{children}</main>
    </div>
  );
}
