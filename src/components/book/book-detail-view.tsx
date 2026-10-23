"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  Download,
  FileJson,
  FileText,
  Loader2,
  MoreHorizontal,
  PencilLine,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { BookCover } from "@/components/library/book-cover";
import { RelativeTime } from "@/components/relative-time";
import { chapterStatusMeta } from "@/lib/chapter-status";
import { formatDate } from "@/lib/utils";
import type { Outline } from "@/lib/schemas";

const numberFormat = new Intl.NumberFormat("en");

export function BookDetailView({
  slug,
  outline,
  wordCount,
  chapterCount,
  presetName,
}: {
  slug: string;
  outline: Outline;
  wordCount: number;
  chapterCount: number;
  presetName?: string;
}) {
  const router = useRouter();
  const [renameOpen, setRenameOpen] = useState(false);
  const [title, setTitle] = useState(outline.title);
  const [premise, setPremise] = useState(outline.premise);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [statusPending, setStatusPending] = useState(false);
  const complete = outline.status === "complete";

  async function saveMeta(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setFormError(null);
    try {
      const response = await fetch(`/api/novels/${slug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, premise }),
      });
      const payload = (await response.json()) as { error?: { message?: string } };
      if (!response.ok) {
        setFormError(payload.error?.message || "The book could not be updated.");
        return;
      }
      setRenameOpen(false);
      toast.success("Book details saved.");
      router.refresh();
    } catch {
      setFormError("Could not reach the app server.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleComplete() {
    setStatusPending(true);
    try {
      const response = await fetch(`/api/novels/${slug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: complete ? "active" : "complete" }),
      });
      if (!response.ok) {
        toast.error("The status could not be changed.");
        return;
      }
      toast.success(complete ? "Book reopened." : "Book marked complete.");
      router.refresh();
    } catch {
      toast.error("Could not reach the app server.");
    } finally {
      setStatusPending(false);
    }
  }

  async function remove() {
    try {
      const response = await fetch(`/api/novels/${slug}`, { method: "DELETE" });
      if (!response.ok) {
        toast.error("The book could not be deleted.");
        return;
      }
      toast.success("Book moved to the trash folder.");
      router.replace("/");
      router.refresh();
    } catch {
      toast.error("Could not reach the app server.");
    }
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto w-full max-w-6xl px-5 pb-16 pt-5 sm:px-8">
        <div className="flex items-center justify-between gap-3">
          <Button asChild variant="ghost" size="sm" className="-ml-2">
            <Link href="/">
              <ArrowLeft />
              Library
            </Link>
          </Button>
          <div className="flex items-center gap-2">
            <Button asChild variant="secondary" size="sm">
              <Link href={`/novels/${slug}/read`}>
                <BookOpen />
                Read
              </Link>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label="More book actions">
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => setRenameOpen(true)}>
                  <PencilLine />
                  Edit title and premise
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={toggleComplete} disabled={statusPending}>
                  <Check />
                  {complete ? "Reopen book" : "Mark book complete"}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <a href={`/api/novels/${slug}/export?format=md`} download>
                    <Download />
                    Export Markdown
                  </a>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <a href={`/api/novels/${slug}/export?format=docx`} download>
                    <FileText />
                    Export DOCX
                  </a>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <a href={`/api/novels/${slug}/export?format=html`} download>
                    <FileJson />
                    Export HTML
                  </a>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <section className="mt-6 grid gap-8 md:grid-cols-[220px_minmax(0,1fr)] md:gap-10">
          <div className="relative flex items-start justify-center md:justify-start">
            <div
              className="pointer-events-none absolute -left-10 -top-10 size-72 rounded-full bg-[radial-gradient(circle,rgba(242,169,59,0.1),transparent_65%)]"
              aria-hidden="true"
            />
            <BookCover title={outline.title} slug={slug} size="lg" className="relative" />
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <Badge variant={complete ? "success" : "amber"}>
                {complete ? "Complete" : "Drafting"}
              </Badge>
              <span className="text-[11px] text-muted-foreground" suppressHydrationWarning>
                Started {formatDate(outline.createdAt)} · edited{" "}
                <RelativeTime value={outline.updatedAt} />
                {presetName ? ` · preset: ${presetName}` : ""}
              </span>
            </div>
            <h1 className="mt-3 font-serif text-[2.7rem] leading-[1.02] tracking-[-0.03em] md:text-[3.2rem]">
              {outline.title}
            </h1>
            <p className="mt-3 max-w-2xl whitespace-pre-wrap text-[13.5px] leading-relaxed text-muted-foreground">
              {outline.premise || "No premise recorded yet."}
            </p>

            <dl className="mt-6 grid max-w-xl grid-cols-2 gap-x-6 gap-y-3 border-t border-border pt-4 sm:grid-cols-4">
              <Stat label="Words" value={numberFormat.format(wordCount)} />
              <Stat label="Chapters" value={String(chapterCount)} />
              <Stat label="Current" value={String(outline.currentChapter)} />
              <Stat
                label="In vault"
                value={`${outline.chapters.filter((chapter) => chapter.summary && !chapter.summaryStale).length}/${chapterCount}`}
              />
            </dl>

            <div className="mt-6 flex flex-wrap items-center gap-2">
              <Button asChild>
                <Link href={`/novels/${slug}/write?chapter=${outline.currentChapter}`}>
                  {complete ? "Edit the book" : "Continue writing"}
                  <ArrowRight />
                </Link>
              </Button>
              <Button asChild variant="secondary">
                <Link href={`/novels/${slug}/read`}>
                  <BookOpen />
                  Reading mode
                </Link>
              </Button>
            </div>
          </div>
        </section>

        <div className="mt-12 grid gap-10 lg:grid-cols-[minmax(0,1fr)_320px]">
          <section aria-labelledby="chapters-heading">
            <div className="flex items-baseline justify-between gap-3 border-b border-border pb-3">
              <h2 id="chapters-heading" className="text-[14px] font-semibold">
                Chapters
              </h2>
              <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                {chapterCount} {chapterCount === 1 ? "chapter" : "chapters"}
              </span>
            </div>
            <ol className="divide-y divide-border">
              {outline.chapters.map((chapter) => {
                const meta = chapterStatusMeta(chapter.status, chapter.summaryStale);
                return (
                  <li key={chapter.number}>
                    <Link
                      href={`/novels/${slug}/write?chapter=${chapter.number}`}
                      className="group grid grid-cols-[38px_minmax(0,1fr)] gap-4 py-4 transition-colors hover:bg-white/[0.018] sm:grid-cols-[38px_minmax(0,1fr)_auto]"
                    >
                      <span className="font-mono text-[11px] tabular text-muted-foreground">
                        {String(chapter.number).padStart(2, "0")}
                      </span>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-[13px] font-medium text-foreground group-hover:text-[#f4c477]">
                            {chapter.title}
                          </h3>
                          <Badge
                            variant={
                              meta.tone === "success"
                                ? "success"
                                : meta.tone === "danger"
                                  ? "danger"
                                  : meta.tone === "amber"
                                    ? "amber"
                                    : "default"
                            }
                          >
                            {meta.label}
                          </Badge>
                        </div>
                        <p className="mt-1 line-clamp-2 text-[12px] leading-relaxed text-muted-foreground">
                          {chapter.summary ||
                            (chapter.status === "planned"
                              ? "Not drafted yet."
                              : "No summary in the vault yet.")}
                        </p>
                      </div>
                      <div className="col-span-2 flex items-center justify-between gap-5 pl-[54px] text-[11px] text-muted-foreground sm:col-span-1 sm:justify-end sm:pl-0">
                        <span className="tabular">{numberFormat.format(chapter.wordCount)} words</span>
                        <ArrowRight className="size-4 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ol>
          </section>

          <aside className="space-y-6 lg:sticky lg:top-6 lg:self-start">
            <section>
              <h2 className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#f2c477]">
                Story Vault
              </h2>
              <p className="mt-2 whitespace-pre-wrap text-[12.5px] leading-relaxed text-foreground/85">
                {outline.premise || "No premise recorded yet."}
              </p>
            </section>

            <section>
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#f2c477]">
                  Characters
                </h2>
                <span className="font-mono text-[10px] text-muted-foreground">
                  {outline.characters.length}
                </span>
              </div>
              {outline.characters.length ? (
                <ul className="mt-2 divide-y divide-border border-y border-border">
                  {outline.characters.map((character) => (
                    <li key={character.name} className="py-2.5">
                      <p className="text-[12.5px] font-medium text-foreground/90">
                        {character.name}
                        {character.role ? (
                          <span className="ml-2 font-mono text-[9px] uppercase tracking-[0.1em] text-muted-foreground">
                            {character.role}
                          </span>
                        ) : null}
                      </p>
                      {character.description ? (
                        <p className="mt-1 text-[11.5px] leading-relaxed text-muted-foreground">
                          {character.description}
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-[12px] text-muted-foreground">
                  No character sheet yet.
                </p>
              )}
            </section>

            <section className="border-t border-border pt-4">
              <h2 className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                Files
              </h2>
              <ul className="mt-2 space-y-1.5 font-mono text-[10.5px] text-muted-foreground">
                <li>vibedraft.db ? settings, vault, chats</li>
                <li>novels/{slug}/chapters/*.md</li>
                <li>novels/{slug}/chapters/.history/</li>
              </ul>
            </section>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="sm" className="-ml-2 text-muted-foreground hover:text-[#f2937f]">
                  <Trash2 />
                  Delete book
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Move “{outline.title}” to the trash?</AlertDialogTitle>
                  <AlertDialogDescription>
                    The project folder is moved into <span className="font-mono">novels/.trash</span>{" "}
                    on your volume. You can recover it from the filesystem, but not from the app.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Keep the book</AlertDialogCancel>
                  <AlertDialogAction onClick={remove}>Move to trash</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </aside>
        </div>
      </div>

      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent>
          <form onSubmit={saveMeta} className="space-y-4">
            <DialogHeader>
              <DialogTitle>Book details</DialogTitle>
              <DialogDescription>
                The title and premise live in the SQLite book row. Renaming does not change the slug or move the folder.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="book-title">Title</Label>
              <Input
                id="book-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                maxLength={200}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="book-premise">Premise</Label>
              <Textarea
                id="book-premise"
                value={premise}
                onChange={(event) => setPremise(event.target.value)}
                className="min-h-36"
                maxLength={20_000}
              />
            </div>
            {formError ? (
              <p className="text-[12px] leading-relaxed text-[#f2937f]">{formError}</p>
            ) : null}
            <DialogFooter>
              <Button type="button" variant="secondary" onClick={() => setRenameOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving || !title.trim()}>
                {saving ? <Loader2 className="animate-spin" /> : null}
                {saving ? "Saving…" : "Save details"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-0.5 tabular text-[17px] text-foreground/90">{value}</dd>
    </div>
  );
}
