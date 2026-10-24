"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Archive,
  ArchiveRestore,
  ArrowRight,
  BookOpen,
  MoreHorizontal,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { BookCover } from "@/components/library/book-cover";
import { RelativeTime } from "@/components/relative-time";
import { NewBookDialog } from "@/components/books/new-book-dialog";
import { illustrationUrl } from "@/lib/pages";
import type { ModelRoles, NovelListItem, Preset, Provider } from "@/lib/schemas";

type Filter = "all" | "drafting" | "complete";

const numberFormat = new Intl.NumberFormat("en");

export function LibraryView({
  novels,
  archivedNovels,
  presets,
  defaultPresetId,
  globalModels,
  providers,
}: {
  novels: NovelListItem[];
  archivedNovels: NovelListItem[];
  presets: Preset[];
  defaultPresetId: string;
  globalModels: ModelRoles | null;
  providers: Array<Pick<Provider, "id" | "name">>;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [view, setView] = useState<"active" | "archived">("active");
  const [newOpen, setNewOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "/" && document.activeElement?.tagName !== "INPUT" && document.activeElement?.tagName !== "TEXTAREA") {
        event.preventDefault();
        searchRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const visibleNovels = view === "archived" ? archivedNovels : novels;
  const totalWords = visibleNovels.reduce((total, novel) => total + novel.wordCount, 0);
  const featured = view === "active" ? (novels[0] ?? null) : null;

  const needle = query.trim().toLowerCase();
  const filtered = visibleNovels.filter((novel) => {
    const matchesQuery =
      !needle ||
      novel.title.toLowerCase().includes(needle) ||
      novel.premise.toLowerCase().includes(needle);
    const matchesFilter =
      filter === "all" ||
      (filter === "drafting" && novel.status !== "complete") ||
      (filter === "complete" && novel.status === "complete");
    return matchesQuery && matchesFilter;
  });

  const searching = Boolean(query.trim()) || filter !== "all";
  const showList = view === "archived" || visibleNovels.length > 1 || searching;
  const emptyLibrary = view === "active" && novels.length === 0;
  const emptyArchive = view === "archived" && archivedNovels.length === 0;

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto w-full max-w-6xl px-5 pb-16 pt-8 sm:px-8 lg:pt-10">
        <header className="flex flex-col gap-5 border-b border-border pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="font-serif text-[2.4rem] leading-none tracking-[-0.03em]">
              {view === "archived" ? "The archive." : "The shelf."}
            </h1>
            <p className="mt-2.5 text-[13px] text-muted-foreground">
              {visibleNovels.length === 0
                ? view === "archived"
                  ? "No archived books."
                  : "A private catalog for long-form work."
                : `${visibleNovels.length} ${visibleNovels.length === 1 ? "book" : "books"} · ${numberFormat.format(totalWords)} words · files in your data volume`}
            </p>
          </div>
          <div className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto">
            <div className="flex items-center gap-0.5 rounded-md border border-border bg-[#0c1218] p-0.5">
              {(
                [
                  ["active", "Active"],
                  ["archived", `Archived${archivedNovels.length ? ` (${archivedNovels.length})` : ""}`],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => {
                    setView(value);
                    setQuery("");
                    setFilter("all");
                  }}
                  aria-pressed={view === value}
                  className={`rounded-[4px] px-2.5 py-1 text-[11.5px] transition-colors ${
                    view === value
                      ? "bg-secondary text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="relative w-full sm:w-72">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                ref={searchRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search titles and premises"
                aria-label="Search the library"
                className="h-9 w-full rounded-md border border-input bg-[#0c1218] pl-8 pr-8 text-[13px] text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-[#5b4a2c] focus:ring-2 focus:ring-ring/40"
              />
              {query ? (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:bg-white/5 hover:text-foreground"
                  aria-label="Clear search"
                >
                  <X className="size-3.5" />
                </button>
              ) : (
                <kbd className="pointer-events-none absolute right-2 top-1/2 hidden -translate-y-1/2 rounded border border-border px-1 font-mono text-[9px] text-muted-foreground/70 sm:block">
                  /
                </kbd>
              )}
            </div>
            {view === "active" ? (
              <Button onClick={() => setNewOpen(true)} className="shrink-0">
                <Plus />
                Create new
              </Button>
            ) : null}
          </div>
        </header>

        {emptyLibrary ? (
          <EmptyShelf onCreate={() => setNewOpen(true)} />
        ) : emptyArchive ? (
          <div className="mt-8 rounded-lg border border-dashed border-border px-6 py-16 text-center">
            <Archive className="mx-auto size-6 text-muted-foreground" />
            <p className="mt-3 text-[14px] text-foreground">The archive is empty.</p>
            <p className="mt-1 text-[12.5px] text-muted-foreground">
              Archived books stay out of the shelf until you restore them.
            </p>
          </div>
        ) : (
          <>
            {!searching && featured ? <FeaturedBook novel={featured} /> : null}

            {showList ? (
            <section className="mt-10" aria-labelledby="all-books">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-baseline gap-3">
                  <h2 id="all-books" className="text-[14px] font-semibold tracking-[-0.01em]">
                    {searching
                      ? "Results"
                      : view === "archived"
                        ? "Archived books"
                        : "All books"}
                  </h2>
                  <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                    {filtered.length} {filtered.length === 1 ? "title" : "titles"}
                  </span>
                </div>
                <div className="flex items-center gap-0.5 rounded-md border border-border bg-[#0c1218] p-0.5">
                  {(
                    [
                      ["all", "All"],
                      ["drafting", "Drafting"],
                      ["complete", "Complete"],
                    ] as const
                  ).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setFilter(value)}
                      aria-pressed={filter === value}
                      className={`rounded-[4px] px-2.5 py-1 text-[11.5px] transition-colors ${
                        filter === value
                          ? "bg-secondary text-foreground shadow-[0_1px_0_rgba(255,255,255,0.04)_inset]"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {filtered.length === 0 ? (
                <div className="mt-4 border-y border-border py-12 text-center">
                  <p className="text-[14px] text-foreground">No books match that.</p>
                  <p className="mt-1 text-[12.5px] text-muted-foreground">
                    Try a different phrase, or clear the filters.
                  </p>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="mt-4"
                    onClick={() => {
                      setQuery("");
                      setFilter("all");
                    }}
                  >
                    Clear filters
                  </Button>
                </div>
              ) : (
                <ul className="mt-3 divide-y divide-border border-y border-border">
                  {filtered.map((novel) => (
                    <BookRow
                      key={novel.slug}
                      novel={novel}
                      archived={view === "archived"}
                    />
                  ))}
                </ul>
              )}
            </section>
            ) : null}
          </>
        )}
      </div>

      <NewBookDialog
        key={newOpen ? "open" : "closed"}
        open={newOpen}
        onOpenChange={setNewOpen}
        presets={presets}
        defaultPresetId={defaultPresetId}
        globalModels={globalModels}
        providers={providers}
      />
    </div>
  );
}

function FeaturedBook({ novel }: { novel: NovelListItem }) {
  const complete = novel.status === "complete";
  return (
    <section className="relative mt-8 overflow-hidden rounded-lg border border-border bg-[#0d131a] shadow-[0_28px_70px_-40px_rgba(0,0,0,0.9)]">
      <div
        className="pointer-events-none absolute -left-20 top-1/2 size-[26rem] -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(242,169,59,0.13),transparent_62%)]"
        aria-hidden="true"
      />
      <div className="relative grid md:grid-cols-[250px_1fr]">
        <div className="flex items-center justify-center border-b border-border px-8 py-8 md:border-b-0 md:border-r">
          <BookCover
            title={novel.title}
            slug={novel.slug}
            imageSrc={
              novel.coverImagePath
                ? illustrationUrl(novel.slug, novel.coverImagePath)
                : undefined
            }
            size="lg"
          />
        </div>
        <div className="flex min-w-0 flex-col justify-center p-6 md:p-8">
          <div className="flex flex-wrap items-center gap-2.5">
            <Badge variant="amber">On the desk</Badge>
            <span className="text-[11px] text-muted-foreground">
              Edited <RelativeTime value={novel.updatedAt} />
            </span>
          </div>
          <h2 className="mt-3 font-serif text-[2rem] leading-[1.08] tracking-[-0.02em] md:text-[2.4rem]">
            {novel.title}
          </h2>
          <p className="mt-2.5 line-clamp-3 max-w-2xl text-[13px] leading-relaxed text-muted-foreground">
            {novel.premise || "No premise recorded yet. Open the book to continue shaping it."}
          </p>
          <dl className="mt-5 flex flex-wrap gap-x-7 gap-y-2 text-[11.5px]">
            <div className="flex items-baseline gap-1.5">
              <dt className="text-muted-foreground">Chapter</dt>
              <dd className="tabular text-foreground/90">{novel.currentChapterNumber}</dd>
            </div>
            <div className="flex items-baseline gap-1.5">
              <dt className="text-muted-foreground">Words</dt>
              <dd className="tabular text-foreground/90">{numberFormat.format(novel.wordCount)}</dd>
            </div>
            <div className="flex items-baseline gap-1.5">
              <dt className="text-muted-foreground">Chapters</dt>
              <dd className="tabular text-foreground/90">{novel.chapterCount}</dd>
            </div>
            <div className="flex items-baseline gap-1.5">
              <dt className="text-muted-foreground">Status</dt>
              <dd className="text-foreground/90">{complete ? "Complete" : "Drafting"}</dd>
            </div>
          </dl>
          <div className="mt-6 flex flex-wrap items-center gap-2">
            <Button asChild>
              <Link href={`/novels/${novel.slug}/write?chapter=${novel.currentChapter}`}>
                {complete ? "Edit the book" : "Continue writing"}
                <ArrowRight />
              </Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href={`/novels/${novel.slug}/read`}>
                <BookOpen />
                Reading mode
              </Link>
            </Button>
            <Link
              href={`/novels/${novel.slug}`}
              className="rounded px-1.5 py-1 text-[12px] text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              Details
            </Link>
            <BookActionsMenu novel={novel} archived={false} />
          </div>
        </div>
      </div>
    </section>
  );
}

function BookRow({
  novel,
  archived,
}: {
  novel: NovelListItem;
  archived: boolean;
}) {
  return (
    <li className="flex items-center gap-2">
      <Link
        href={`/novels/${novel.slug}`}
        className="group grid min-w-0 flex-1 grid-cols-[56px_1fr] items-center gap-4 py-4 transition-colors hover:bg-white/[0.018] sm:grid-cols-[56px_1fr_auto] sm:gap-5"
      >
        <BookCover
          title={novel.title}
          slug={novel.slug}
          imageSrc={
            novel.coverImagePath
              ? illustrationUrl(novel.slug, novel.coverImagePath)
              : undefined
          }
        />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-[14px] font-medium tracking-[-0.01em] text-foreground group-hover:text-[#f4c477]">
              {novel.title}
            </h3>
            <Badge variant={novel.status === "complete" ? "success" : "default"}>
              {novel.status === "complete" ? "Complete" : "Drafting"}
            </Badge>
          </div>
          <p className="mt-1 line-clamp-1 text-[12px] text-muted-foreground">
            {novel.premise || "No premise yet."}
          </p>
        </div>
        <div className="col-span-2 flex items-center justify-between gap-6 pl-[72px] text-[11px] text-muted-foreground sm:col-span-1 sm:justify-end sm:pl-0">
          <span className="tabular">{numberFormat.format(novel.wordCount)} words</span>
          <span className="tabular hidden md:inline">Ch. {novel.currentChapterNumber}</span>
          <span className="hidden w-24 text-right lg:inline">
            <RelativeTime value={novel.updatedAt} />
          </span>
          <ArrowRight className="size-4 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
        </div>
      </Link>
      <BookActionsMenu novel={novel} archived={archived} />
    </li>
  );
}

function BookActionsMenu({
  novel,
  archived,
}: {
  novel: NovelListItem;
  archived: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  async function setArchive(next: boolean) {
    setPending(true);
    try {
      const response = await fetch(`/api/novels/${novel.slug}`, {
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
      router.refresh();
    } catch {
      toast.error("Could not reach the app server.");
    } finally {
      setPending(false);
    }
  }

  async function removePermanently() {
    setPending(true);
    try {
      const response = await fetch(`/api/novels/${novel.slug}?permanent=1`, {
        method: "DELETE",
      });
      const payload = (await response.json()) as { error?: { message?: string } };
      if (!response.ok) {
        toast.error(payload.error?.message || "The book could not be deleted.");
        return;
      }
      setConfirmOpen(false);
      toast.success("Book permanently deleted.");
      router.refresh();
    } catch {
      toast.error("Could not reach the app server.");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Actions for ${novel.title}`}
            disabled={pending}
          >
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {archived ? (
            <>
              <DropdownMenuItem onSelect={() => void setArchive(false)} disabled={pending}>
                <ArchiveRestore />
                Restore to shelf
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={() => setConfirmOpen(true)}
                disabled={pending}
                className="text-[#f2937f] focus:text-[#f2937f]"
              >
                <Trash2 />
                Permanently delete
              </DropdownMenuItem>
            </>
          ) : (
            <DropdownMenuItem onSelect={() => void setArchive(true)} disabled={pending}>
              <Archive />
              Move to archive
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Permanently delete “{novel.title}”?</AlertDialogTitle>
            <AlertDialogDescription>
              The database row, manuscript Markdown, illustrations, and chat history are
              removed from the data volume. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Keep it</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void removePermanently()}
              disabled={pending}
              className="bg-[#3a1c18] text-[#f2937f] hover:bg-[#4a241e]"
            >
              {pending ? "Deleting…" : "Delete forever"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function EmptyShelf({ onCreate }: { onCreate: () => void }) {
  return (
    <section className="mt-8 grid overflow-hidden rounded-lg border border-border bg-[#0d131a] md:grid-cols-[1fr_320px]">
      <div className="flex flex-col justify-center p-7 md:p-10">
        <h2 className="font-serif text-[2.2rem] leading-[1.06] tracking-[-0.02em]">
          No book on the desk yet.
        </h2>
        <p className="mt-3 max-w-md text-[13px] leading-relaxed text-muted-foreground">
          Start with an idea, not a title. You will talk it through with the Planner, the
          Summarizer will distill the premise, and the book will name itself. Then the chapter
          loop begins.
        </p>
        <ol className="mt-6 grid max-w-md gap-2 border-t border-border pt-4">
          {[
            ["Talk it through", "The Planner asks what the book is actually about."],
            ["Premise done", "The vault gets a premise and an automatic title."],
            ["Chapter one", "Plan, execute, summarize, continue."],
          ].map(([title, detail], index) => (
            <li key={title} className="grid grid-cols-[28px_1fr] gap-2 text-[12px]">
              <span className="font-mono text-[10px] text-primary/80">{String(index + 1).padStart(2, "0")}</span>
              <span>
                <span className="text-foreground/90">{title}</span>
                <span className="text-muted-foreground"> — {detail}</span>
              </span>
            </li>
          ))}
        </ol>
        <div className="mt-7">
          <Button onClick={onCreate}>
            <Plus />
            Create the first book
          </Button>
        </div>
      </div>
      <div className="relative hidden items-center justify-center border-l border-border bg-[#0a0e13] p-8 md:flex">
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,rgba(242,169,59,0.1),transparent_60%)]"
          aria-hidden="true"
        />
        <div className="paper-sheet relative w-full max-w-[230px] rounded-[3px] p-5">
          <div className="font-mono text-[7px] uppercase tracking-[0.22em] text-[#8a7c66]">Chapter one</div>
          <div className="mt-3 h-px w-8 bg-[#a86412]" />
          <div className="mt-4 space-y-2" aria-hidden="true">
            {[100, 92, 96, 78, 100, 88, 94, 60].map((width, index) => (
              <div
                key={index}
                className="h-[2px] rounded-full bg-[#c9bda8]"
                style={{ width: `${width}%` }}
              />
            ))}
          </div>
          <div className="mt-5 flex items-center gap-1.5">
            <span className="size-1 rounded-full bg-[#a86412]" />
            <span className="font-mono text-[7px] uppercase tracking-[0.16em] text-[#8a7c66]">
              waiting for the plan
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
