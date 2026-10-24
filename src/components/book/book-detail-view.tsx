"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Archive,
  ArchiveRestore,
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
  Sparkles,
  Trash2,
  Wand2,
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
import { AddPageMenu } from "@/components/workspace/add-page-menu";
import { CharacterEditorDialog } from "@/components/book/character-editor-dialog";
import { DeletePageButton } from "@/components/workspace/delete-page-button";
import { chapterStatusMeta } from "@/lib/chapter-status";
import { chapterDisplayNumber, chapterDisplayTitle, illustrationUrl } from "@/lib/pages";
import { formatDate } from "@/lib/utils";
import type { Chapter, Character, Outline } from "@/lib/schemas";

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
  const [characters, setCharacters] = useState<Character[] | null>(null);
  const [generatingCharacters, setGeneratingCharacters] = useState(false);
  const [savingCharacters, setSavingCharacters] = useState(false);
  const [characterEditorOpen, setCharacterEditorOpen] = useState(false);
  const [charactersError, setCharactersError] = useState<string | null>(null);
  const [deletingPageNumber, setDeletingPageNumber] = useState<number | null>(null);
  const [generatingTitle, setGeneratingTitle] = useState(false);
  const complete = outline.status === "complete";
  const currentPage =
    outline.chapters.find((item) => item.number === outline.currentChapter) ?? null;
  const currentChapterNumber = currentPage
    ? chapterDisplayNumber(currentPage)
    : outline.currentChapter;
  const displayCharacters = characters ?? outline.characters;

  async function generateCharacters() {
    setGeneratingCharacters(true);
    setCharactersError(null);
    try {
      const response = await fetch(`/api/novels/${slug}/characters/generate`, {
        method: "POST",
      });
      const payload = (await response.json()) as {
        outline?: Outline;
        error?: { message?: string };
      };
      if (!response.ok || !payload.outline) {
        setCharactersError(
          payload.error?.message || "The characters could not be generated.",
        );
        return;
      }
      setCharacters(payload.outline.characters);
      toast.success("Planner extracted the character sheet.");
      router.refresh();
    } catch {
      setCharactersError("Could not reach the app server.");
    } finally {
      setGeneratingCharacters(false);
    }
  }

  async function saveCharacters(next: Character[]) {
    setSavingCharacters(true);
    setCharactersError(null);
    try {
      const response = await fetch(`/api/novels/${slug}/characters`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ characters: next }),
      });
      const payload = (await response.json()) as {
        outline?: Outline;
        error?: { message?: string };
      };
      if (!response.ok || !payload.outline) {
        setCharactersError(payload.error?.message || "The characters could not be saved.");
        return;
      }
      setCharacters(payload.outline.characters);
      setCharacterEditorOpen(false);
      toast.success("Character sheet saved.");
      router.refresh();
    } catch {
      setCharactersError("Could not reach the app server.");
    } finally {
      setSavingCharacters(false);
    }
  }

  async function deletePage(page: Chapter) {
    setDeletingPageNumber(page.number);
    try {
      const response = await fetch(`/api/novels/${slug}/chapters/${page.number}`, {
        method: "DELETE",
      });
      const payload = (await response.json()) as {
        outline?: Outline;
        error?: { message?: string };
      };
      if (!response.ok) {
        toast.error(payload.error?.message || "The page could not be deleted.");
        return;
      }
      toast.success("Page deleted.");
      router.refresh();
    } catch {
      toast.error("Could not reach the app server.");
    } finally {
      setDeletingPageNumber(null);
    }
  }

  async function generateBookTitle() {
    setGeneratingTitle(true);
    setFormError(null);
    try {
      const response = await fetch("/api/ai/title", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, kind: "book", premise }),
      });
      const payload = (await response.json()) as {
        title?: string;
        error?: { message?: string };
      };
      if (!response.ok || !payload.title) {
        setFormError(payload.error?.message || "The title could not be generated.");
        return;
      }
      setTitle(payload.title);
    } catch {
      setFormError("Could not reach the app server.");
    } finally {
      setGeneratingTitle(false);
    }
  }

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

  async function setArchived(next: boolean) {
    try {
      const response = await fetch(`/api/novels/${slug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archived: next }),
      });
      const payload = (await response.json()) as { error?: { message?: string } };
      if (!response.ok) {
        toast.error(payload.error?.message || "The book could not be updated.");
        return;
      }
      toast.success(next ? "Book moved to the archive." : "Book restored.");
      if (next) {
        router.replace("/");
        router.refresh();
      } else {
        router.refresh();
      }
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
                <DropdownMenuItem onSelect={() => void setArchived(!outline.archived)}>
                  {outline.archived ? <ArchiveRestore /> : <Archive />}
                  {outline.archived ? "Restore to shelf" : "Move to archive"}
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
            <BookCover
              title={outline.title}
              slug={slug}
              imageSrc={outline.cover ? illustrationUrl(slug, outline.cover.path) : undefined}
              size="lg"
              className="relative"
            />
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
              <Stat label="Current" value={String(currentChapterNumber)} />
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
            <div className="flex items-center justify-between gap-3 border-b border-border pb-3">
              <div className="flex items-baseline gap-3">
                <h2 id="chapters-heading" className="text-[14px] font-semibold">
                  Chapters
                </h2>
                <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                  {chapterCount} {chapterCount === 1 ? "chapter" : "chapters"}
                </span>
              </div>
              <AddPageMenu slug={slug} />
            </div>
            <ol className="divide-y divide-border">
              {outline.chapters.map((chapter) => {
                const meta = chapterStatusMeta(chapter.status, chapter.summaryStale);
                const illustration = chapter.kind === "illustration";
                return (
                  <li key={chapter.number} className="flex items-center gap-2">
                    <Link
                      href={`/novels/${slug}/write?chapter=${chapter.number}`}
                      className="group grid min-w-0 flex-1 grid-cols-[38px_minmax(0,1fr)] gap-4 py-4 transition-colors hover:bg-white/[0.018] sm:grid-cols-[38px_minmax(0,1fr)_auto]"
                    >
                      <span className="font-mono text-[11px] tabular text-muted-foreground">
                        {illustration
                          ? "IMG"
                          : String(chapterDisplayNumber(chapter)).padStart(2, "0")}
                      </span>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-[13px] font-medium text-foreground group-hover:text-[#f4c477]">
                            {illustration ? "Illustration page" : chapterDisplayTitle(chapter)}
                          </h3>
                          <Badge variant={illustration ? "amber" : meta.tone === "success" ? "success" : meta.tone === "danger" ? "danger" : meta.tone === "amber" ? "amber" : "default"}>
                            {illustration
                              ? chapter.image
                                ? "Image ready"
                                : "Needs image"
                              : meta.label}
                          </Badge>
                        </div>
                        <p className="mt-1 line-clamp-2 text-[12px] leading-relaxed text-muted-foreground">
                          {illustration
                            ? chapter.image?.prompt || "Add a generated plate between chapters."
                            : chapter.summary ||
                              (chapter.status === "planned"
                                ? "Not drafted yet."
                                : "No summary in the vault yet.")}
                        </p>
                      </div>
                      <div className="col-span-2 flex items-center justify-between gap-5 pl-[54px] text-[11px] text-muted-foreground sm:col-span-1 sm:justify-end sm:pl-0">
                        <span className="tabular">
                          {illustration ? "Plate" : `${numberFormat.format(chapter.wordCount)} words`}
                        </span>
                        <ArrowRight className="size-4 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
                      </div>
                    </Link>
                    <DeletePageButton
                      page={chapter}
                      compact
                      deleting={deletingPageNumber === chapter.number}
                      onDelete={(page) => void deletePage(page)}
                    />
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
                  {displayCharacters.length}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => void generateCharacters()}
                  disabled={generatingCharacters}
                >
                  {generatingCharacters ? <Loader2 className="animate-spin" /> : <Sparkles />}
                  {generatingCharacters ? "Extracting…" : "Generate Characters"}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setCharacterEditorOpen(true)}
                >
                  <PencilLine />
                  Edit Characters
                </Button>
              </div>
              {charactersError ? (
                <p className="mt-2 rounded-md border border-[#5a2c25] bg-[#241411] p-2.5 text-[11px] leading-relaxed text-[#f2937f]">
                  {charactersError}
                </p>
              ) : null}
              {displayCharacters.length ? (
                <ul className="mt-2 divide-y divide-border border-y border-border">
                  {displayCharacters.map((character) => (
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
                  No character sheet yet. Generate one from the premise or edit it manually.
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
              <div className="flex items-center gap-2">
                <Input
                  id="book-title"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  maxLength={200}
                  required
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="icon-sm"
                  onClick={() => void generateBookTitle()}
                  disabled={generatingTitle || !premise.trim()}
                  aria-label="Generate book title"
                  title="Generate a title from the premise"
                >
                  {generatingTitle ? <Loader2 className="animate-spin" /> : <Wand2 />}
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="book-premise">Premise</Label>
              <Textarea
                id="book-premise"
                value={premise}
                onChange={(event) => setPremise(event.target.value)}
                className="min-h-36"
                maxLength={200_000}
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

      {characterEditorOpen ? (
        <CharacterEditorDialog
          open
          onOpenChange={setCharacterEditorOpen}
          initial={displayCharacters}
          saving={savingCharacters}
          onSave={(next) => void saveCharacters(next)}
        />
      ) : null}
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

