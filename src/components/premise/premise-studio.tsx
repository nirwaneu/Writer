"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Check,
  CircleAlert,
  Loader2,
  PenLine,
  Sparkles,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { ChatThread } from "@/components/chat/chat-thread";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { StatusDot } from "@/components/status-dot";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { usePlannerStream } from "@/lib/use-chat-stream";
import type { ChatMessage, Outline } from "@/lib/schemas";
import { cn } from "@/lib/utils";

type Phase = "chat" | "distilling" | "failed" | "manual";

export function PremiseStudio({
  draftId,
  outline,
  initialMessages,
}: {
  draftId: string;
  outline: Outline;
  initialMessages: ChatMessage[];
}) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("chat");
  const [publishError, setPublishError] = useState<string | null>(null);
  const [manualTitle, setManualTitle] = useState("");
  const [manualPremise, setManualPremise] = useState("");
  const [finalizing, setFinalizing] = useState(false);
  const [discarding, setDiscarding] = useState(false);

  const chat = usePlannerStream({
    streamKey: `planner:draft:${draftId}`,
    endpoint: "/api/ai/planner",
    initialMessages,
    baseBody: { scope: "premise", draftId },
    mutateEndpoint: `/api/drafts/${draftId}/chat`,
  });

  const exchanges = useMemo(
    () => chat.messages.filter((message) => message.role === "assistant" && !message.failed).length,
    [chat.messages],
  );
  const hasExchange = exchanges > 0;

  async function finishPremise() {
    setPhase("distilling");
    setPublishError(null);
    try {
      const response = await fetch("/api/ai/premise", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draftId }),
      });
      const payload = (await response.json()) as {
        slug?: string;
        title?: string;
        titleFallback?: boolean;
        error?: { message?: string };
      };
      if (!response.ok || !payload.slug) {
        setPhase("failed");
        setPublishError(
          payload.error?.message ||
            "The premise could not be distilled. Your brainstorm is saved.",
        );
        return;
      }
      if (payload.titleFallback) {
        toast.info("The book was named Untitled Novel. Rename it from Details.");
      } else {
        toast.success(`Premise saved. “${payload.title}” is on the shelf.`);
      }
      router.replace(`/novels/${payload.slug}/write?chapter=1`);
    } catch {
      setPhase("failed");
      setPublishError("Could not reach the app server. Your brainstorm is saved.");
    }
  }

  async function finalizeManually(event: React.FormEvent) {
    event.preventDefault();
    if (!manualPremise.trim()) {
      setPublishError("Write the premise before opening the book.");
      return;
    }
    setFinalizing(true);
    setPublishError(null);
    try {
      const response = await fetch(`/api/drafts/${draftId}/finalize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: manualTitle.trim() || "Untitled Novel",
          premise: manualPremise.trim(),
        }),
      });
      const payload = (await response.json()) as {
        slug?: string;
        error?: { message?: string };
      };
      if (!response.ok || !payload.slug) {
        setPublishError(payload.error?.message || "The book could not be created.");
        return;
      }
      toast.success("Book created. Chapter one is ready.");
      router.replace(`/novels/${payload.slug}/write?chapter=1`);
    } catch {
      setPublishError("Could not reach the app server.");
    } finally {
      setFinalizing(false);
    }
  }

  async function discard() {
    setDiscarding(true);
    try {
      const response = await fetch(`/api/drafts/${draftId}`, { method: "DELETE" });
      if (!response.ok) {
        toast.error("The draft could not be discarded.");
        return;
      }
      router.replace("/");
    } catch {
      toast.error("Could not reach the app server.");
    } finally {
      setDiscarding(false);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex shrink-0 items-center justify-between gap-4 border-b border-border px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <Button asChild variant="ghost" size="icon-sm" aria-label="Back to library">
            <Link href="/">
              <ArrowLeft />
            </Link>
          </Button>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">
                New book · Premise
              </span>
              <Badge variant="amber">Draft</Badge>
            </div>
            <h1 className="truncate font-serif text-[20px] leading-tight tracking-[-0.01em]">
              {outline.title}
            </h1>
          </div>
        </div>
        <div className="hidden items-center gap-2 text-[11px] text-muted-foreground sm:flex">
          <StatusDot tone="success" />
          Saved to disk
        </div>
      </header>

      <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex min-h-[62vh] flex-col border-b border-border lg:min-h-0 lg:border-b-0">
          <ChatThread
            messages={chat.messages}
            streamingContent={chat.streamingContent}
            streamingReasoning={chat.streamingReasoning}
            streaming={chat.streaming}
            error={chat.error}
            onSend={chat.send}
            onRetry={chat.retry}
            onStop={chat.stop}
            onRegenerate={chat.regenerate}
            onDeleteMessage={chat.deleteMessage}
            onSwitchVersion={chat.switchVersion}
            onEditMessage={chat.editMessage}
            disabled={phase !== "chat"}
            placeholder="What is this book about?"
            empty={
              <div className="max-w-xl">
                <h2 className="font-serif text-[1.6rem] leading-tight tracking-[-0.02em]">
                  Start with the idea, not the title.
                </h2>
                <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
                  Tell the Planner what you want to write: the person, the pressure, the thing
                  you cannot stop thinking about. It will ask questions and help you find the
                  spine of the book. When the idea holds, press{" "}
                  <span className="text-foreground/90">Premise done</span>.
                </p>
              </div>
            }
            suggestions={[
              "A botanist inherits a house whose garden only blooms at night.",
              "Two rival translators discover they are working from different endings.",
              "A small town elects a mayor who refuses to speak.",
            ]}
          />
        </div>

        <aside className="flex min-h-0 flex-col bg-[#0a0e13]">
          <div className="border-b border-border p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-[13px] font-semibold">The premise</h2>
              <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                {exchanges} {exchanges === 1 ? "exchange" : "exchanges"}
              </span>
            </div>
            <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">
              The vault starts here. Everything the Executor and Summarizer need later is built
              from this conversation.
            </p>

            <ol className="mt-4 space-y-2.5">
              <Step
                label="Talk it through"
                detail={hasExchange ? "The idea has a shape." : "The Planner is listening."}
                state={hasExchange ? "done" : "active"}
              />
              <Step
                label="Distill the premise"
                detail="Summarizer writes it to the Story Vault."
                state={
                  phase === "distilling"
                    ? "active"
                    : hasExchange
                      ? "ready"
                      : "idle"
                }
              />
              <Step
                label="Name the book"
                detail="A title is generated from the premise."
                state={phase === "distilling" ? "active" : "idle"}
              />
              <Step label="Open chapter one" detail="The writing loop begins." state="idle" />
            </ol>
          </div>

          <div className="border-b border-border p-5">
            <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">
              Working title
            </p>
            <p className="mt-1.5 font-serif text-[1.45rem] leading-tight tracking-[-0.01em]">
              {outline.title}
            </p>
            <p className="mt-1.5 text-[11.5px] leading-relaxed text-muted-foreground">
              The title is generated automatically when the premise is done. You can rename the
              book later from its Details page.
            </p>
          </div>

          <div className="mt-auto p-4">
            {phase === "chat" ? (
              <div>
                <Button
                  className="w-full"
                  onClick={finishPremise}
                  disabled={!hasExchange || chat.streaming}
                  title={hasExchange ? undefined : "Talk with the Planner first."}
                >
                  <Check />
                  Premise done
                </Button>
                <p className="mt-2 text-center text-[10.5px] leading-relaxed text-muted-foreground">
                  {hasExchange
                    ? "Summarizes the chat, names the book, and opens chapter one."
                    : "Available once the Planner has replied."}
                </p>
              </div>
            ) : null}

            {phase === "distilling" ? (
              <div className="rounded-md border border-[#5b431c] bg-[#1b1409] p-3.5">
                <div className="flex items-center gap-2 text-[12px] text-[#f2c477]">
                  <Loader2 className="size-4 animate-spin" />
                  Distilling the premise…
                </div>
                <div className="mt-3 h-0.5 overflow-hidden rounded-full bg-[#3a2c15]">
                  <div className="h-full w-1/2 animate-shimmer rounded-full bg-[linear-gradient(90deg,transparent,#f2a93b,transparent)] bg-[length:200%_100%]" />
                </div>
                <p className="mt-2.5 text-[11px] leading-relaxed text-[#c9a86e]">
                  The Summarizer is writing the premise and naming the book. This can take a
                  moment.
                </p>
              </div>
            ) : null}

            {phase === "failed" ? (
              <div className="rounded-md border border-[#5a2c25] bg-[#241411] p-3.5">
                <div className="flex items-start gap-2 text-[12px] leading-relaxed text-[#f2937f]">
                  <CircleAlert className="mt-0.5 size-4 shrink-0" />
                  <p>{publishError || "The premise could not be distilled."}</p>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" variant="secondary" onClick={finishPremise}>
                    <Sparkles />
                    Try again
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setPhase("manual");
                      setPublishError(null);
                    }}
                  >
                    <PenLine />
                    Write it myself
                  </Button>
                </div>
              </div>
            ) : null}

            {phase === "manual" ? (
              <form onSubmit={finalizeManually} className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="manual-title">Title</Label>
                  <Input
                    id="manual-title"
                    value={manualTitle}
                    onChange={(event) => setManualTitle(event.target.value)}
                    placeholder="Untitled Novel"
                    maxLength={200}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="manual-premise">Premise</Label>
                  <Textarea
                    id="manual-premise"
                    value={manualPremise}
                    onChange={(event) => setManualPremise(event.target.value)}
                    placeholder="What is the book about?"
                    className="min-h-32"
                    maxLength={20_000}
                  />
                </div>
                {publishError ? (
                  <p className="text-[11.5px] leading-relaxed text-[#f2937f]">{publishError}</p>
                ) : null}
                <div className="flex gap-2">
                  <Button type="submit" size="sm" disabled={finalizing || !manualPremise.trim()}>
                    {finalizing ? <Loader2 className="animate-spin" /> : <Check />}
                    Create the book
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setPhase("failed")}
                    disabled={finalizing}
                  >
                    Back
                  </Button>
                </div>
              </form>
            ) : null}

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <button
                  type="button"
                  className="mt-3 flex w-full items-center justify-center gap-1.5 rounded px-2 py-1.5 text-[11px] text-muted-foreground/70 transition-colors hover:text-[#f2937f]"
                >
                  <Trash2 className="size-3" />
                  Discard this draft
                </button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Discard this draft?</AlertDialogTitle>
                  <AlertDialogDescription>
                    The brainstorm chat and the working title will be deleted. This cannot be
                    undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Keep it</AlertDialogCancel>
                  <AlertDialogAction onClick={discard} disabled={discarding}>
                    {discarding ? "Discarding…" : "Discard draft"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Step({
  label,
  detail,
  state,
}: {
  label: string;
  detail: string;
  state: "idle" | "active" | "ready" | "done";
}) {
  return (
    <li className="grid grid-cols-[16px_1fr] gap-2.5">
      <span className="mt-0.5 flex size-4 items-center justify-center">
        {state === "done" ? (
          <span className="flex size-3.5 items-center justify-center rounded-full bg-[#2d4a36] text-[#9cc9a6]">
            <Check className="size-2.5" />
          </span>
        ) : state === "active" ? (
          <Loader2 className="size-3.5 animate-spin text-primary" />
        ) : state === "ready" ? (
          <span className="size-1.5 rounded-full bg-primary/70" />
        ) : (
          <span className="size-1.5 rounded-full bg-muted-foreground/30" />
        )}
      </span>
      <span>
        <span
          className={cn(
            "block text-[12px]",
            state === "idle" ? "text-muted-foreground" : "text-foreground/90",
          )}
        >
          {label}
        </span>
        <span className="block text-[10.5px] leading-relaxed text-muted-foreground">{detail}</span>
      </span>
    </li>
  );
}
