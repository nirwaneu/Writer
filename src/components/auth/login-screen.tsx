"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2, LockKeyhole, TriangleAlert } from "lucide-react";
import { Wordmark } from "@/components/wordmark";

export function LoginScreen({
  nextPath,
  configured,
}: {
  nextPath: string;
  configured: boolean;
}) {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const usernameRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const lastPointerToggle = useRef(0);

  useEffect(() => {
    const usernameInput = usernameRef.current;
    const passwordInput = passwordRef.current;

    const syncFromDom = () => {
      if (usernameInput) setUsername(usernameInput.value);
      if (passwordInput) setPassword(passwordInput.value);
    };

    usernameInput?.addEventListener("input", syncFromDom);
    usernameInput?.addEventListener("change", syncFromDom);
    passwordInput?.addEventListener("input", syncFromDom);
    passwordInput?.addEventListener("change", syncFromDom);

    return () => {
      usernameInput?.removeEventListener("input", syncFromDom);
      usernameInput?.removeEventListener("change", syncFromDom);
      passwordInput?.removeEventListener("input", syncFromDom);
      passwordInput?.removeEventListener("change", syncFromDom);
    };
  }, []);

  function togglePassword() {
    setShow((current) => !current);
  }

  function handlePasswordPointerDown(event: React.PointerEvent<HTMLButtonElement>) {
    if (event.pointerType === "mouse") return;
    event.preventDefault();
    lastPointerToggle.current = Date.now();
    togglePassword();
  }

  function handlePasswordClick() {
    if (Date.now() - lastPointerToggle.current < 700) return;
    togglePassword();
  }

  const canSubmit = Boolean(
    configured && !loading && username.trim() && password.trim(),
  );

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!configured || loading) return;

    const submittedUsername = (usernameRef.current?.value ?? username).trim();
    const submittedPassword = passwordRef.current?.value ?? password;
    if (!submittedUsername || !submittedPassword) {
      setError("Enter both the username and password.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: submittedUsername,
          password: submittedPassword,
        }),
      });
      const payload = (await response.json()) as {
        error?: { message?: string };
      };
      if (!response.ok) {
        setError(payload.error?.message || "Sign in failed.");
        setLoading(false);
        return;
      }
      router.replace(nextPath);
      router.refresh();
    } catch {
      setError("Could not reach the app server. Try again.");
      setLoading(false);
    }
  }

  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.05fr_0.95fr]">
      <section className="relative hidden flex-col justify-between overflow-hidden border-r border-border px-10 py-10 lg:flex xl:px-14 xl:py-12">
        <div
          className="absolute -right-32 top-1/4 size-[34rem] rounded-full bg-[radial-gradient(circle,rgba(242,169,59,0.12),transparent_65%)]"
          aria-hidden="true"
        />
        <div className="relative">
          <Wordmark />
        </div>

        <div className="relative max-w-xl">
          <div className="h-px w-10 bg-primary" />
          <h1 className="mt-6 font-serif text-[clamp(2.6rem,4.4vw,4.1rem)] leading-[1.02] tracking-[-0.03em]">
            Plan the chapter.
            <br />
            Draft the page.
            <br />
            <span className="text-[#f2c477]">Keep the book.</span>
          </h1>
          <p className="mt-6 max-w-md text-[14px] leading-relaxed text-muted-foreground">
            The outline is the contract. The Planner helps you decide what a chapter must do,
            the Executor writes it, and the Story Vault remembers what changed.
          </p>
        </div>

        <div className="relative">
          <ol className="max-w-md border-t border-border">
            {[
              ["01", "Brainstorm", "Shape the chapter with the Planner."],
              ["02", "Execute", "The Executor drafts from the plan."],
              ["03", "Summarize", "The vault records what changed."],
              ["04", "Continue", "The next chapter starts informed."],
            ].map(([number, title, detail]) => (
              <li
                key={number}
                className="grid grid-cols-[34px_1fr] gap-3 border-b border-border py-2.5 text-[12px]"
              >
                <span className="font-mono text-[10px] text-primary/80">{number}</span>
                <span>
                  <span className="text-foreground/90">{title}</span>
                  <span className="text-muted-foreground"> — {detail}</span>
                </span>
              </li>
            ))}
          </ol>
          <p className="mt-5 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground/70">
            Self-hosted · SQLite + Markdown
          </p>
        </div>
      </section>

      <section className="flex flex-col items-center justify-center gap-6 px-5 py-10 sm:px-8">
        <div className="lg:hidden">
          <Wordmark />
        </div>

        <div className="paper-sheet w-full max-w-[420px] rounded-md px-7 py-8 sm:px-9 sm:py-10">
          <div className="h-px w-6 bg-[#a86412]" />
          <h2 className="mt-4 font-serif text-[2rem] leading-tight tracking-[-0.02em] text-ink">
            Open the desk.
          </h2>
          <p className="mt-2 text-[12.5px] leading-relaxed text-[#6f6759]">
            Use the credentials set in your <span className="font-mono text-[11px]">.env</span> file.
          </p>

          {!configured ? (
            <div className="mt-5 flex items-start gap-2.5 rounded-[4px] border border-[#c25a45] bg-[#f7e3dc] p-3 text-[12px] leading-relaxed text-[#8a2f1f]">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" />
              <div>
                <p className="font-medium">Login is not configured.</p>
                <p className="mt-1">
                  Set <span className="font-mono text-[11px]">APP_USERNAME</span> and{" "}
                  <span className="font-mono text-[11px]">APP_PASSWORD</span> in{" "}
                  <span className="font-mono text-[11px]">.env</span>, then restart the app.
                </p>
              </div>
            </div>
          ) : null}

          <form onSubmit={submit} className="mt-6 space-y-4">
            <div className="space-y-1.5">
              <label
                htmlFor="username"
                className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-[#5f5546]"
              >
                Username
              </label>
              <input
                ref={usernameRef}
                id="username"
                name="username"
                value={username}
                onChange={(event) => setUsername(event.currentTarget.value)}
                onInput={(event) => setUsername(event.currentTarget.value)}
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                required
                disabled={!configured || loading}
                className="h-10 w-full rounded-[4px] border border-[#d6c9b2] bg-[#fbf6ea] px-3 text-[14px] text-ink outline-none transition-colors placeholder:text-[#7a6e5b] focus:border-[#a86412] focus:ring-2 focus:ring-[#f2a93b]/25 disabled:opacity-60"
                placeholder="your username"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="password"
                className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-[#5f5546]"
              >
                Password
              </label>
              <div className="relative">
                <input
                  ref={passwordRef}
                  id="password"
                  name="password"
                  type={show ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.currentTarget.value)}
                  onInput={(event) => setPassword(event.currentTarget.value)}
                  autoComplete="current-password"
                  required
                  disabled={!configured || loading}
                  className="h-10 w-full rounded-[4px] border border-[#d6c9b2] bg-[#fbf6ea] pl-3 pr-12 text-[14px] text-ink outline-none transition-colors placeholder:text-[#7a6e5b] focus:border-[#a86412] focus:ring-2 focus:ring-[#f2a93b]/25 disabled:opacity-60"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={handlePasswordClick}
                  onPointerDown={handlePasswordPointerDown}
                  className="absolute right-1 top-1/2 flex size-9 -translate-y-1/2 touch-manipulation select-none items-center justify-center rounded-[4px] text-[#7a6e5b] transition-colors hover:bg-[#e9dfcc] hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a86412]"
                  aria-label={show ? "Hide password" : "Show password"}
                  aria-pressed={show}
                >
                  {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            {error ? (
              <div className="rounded-[4px] border border-[#c25a45] bg-[#f7e3dc] px-3 py-2 text-[12px] leading-relaxed text-[#8a2f1f]">
                {error}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={!canSubmit}
              className="mt-1 flex h-10 w-full items-center justify-center gap-2 rounded-[4px] bg-[#1a1712] text-[13px] font-medium text-[#f5eedf] transition-colors hover:bg-[#2c261c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a86412] focus-visible:ring-offset-2 focus-visible:ring-offset-[#f5eedf] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? <Loader2 className="size-4 animate-spin" /> : null}
              {loading ? "Signing in…" : "Enter the desk"}
            </button>
          </form>

          <div className="mt-6 flex items-start gap-2 border-t border-[#ded3bf] pt-4 text-[11px] leading-relaxed text-[#7a6e5b]">
            <LockKeyhole className="mt-0.5 size-3.5 shrink-0" />
            <p>
              One user, one session cookie. The app has no account database and no password reset;
              your credentials live in the server environment.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
