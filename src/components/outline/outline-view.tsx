import { cn } from "@/lib/utils";
import { chapterDisplayNumber, chapterDisplayTitle } from "@/lib/pages";
import { DeletePageButton } from "@/components/workspace/delete-page-button";
import type { Chapter, Outline } from "@/lib/schemas";

export function OutlineView({
  outline,
  className,
  compact = false,
  characterActions,
  onDeletePage,
  deletingPageNumber,
}: {
  outline: Outline;
  className?: string;
  compact?: boolean;
  characterActions?: React.ReactNode;
  onDeletePage?: (page: Chapter) => void;
  deletingPageNumber?: number | null;
}) {
  return (
    <div className={cn("space-y-6", className)}>
      <section>
        <h3 className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#f2c477]">
          Premise
        </h3>
        <p
          className={cn(
            "mt-2 whitespace-pre-wrap leading-relaxed text-foreground/85",
            compact ? "text-[12px]" : "text-[13px]",
          )}
        >
          {outline.premise || "No premise recorded yet."}
        </p>
      </section>

      <section>
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#f2c477]">
            Characters
          </h3>
          <span className="font-mono text-[10px] text-muted-foreground">
            {outline.characters.length}
          </span>
        </div>
        {characterActions ? <div className="mt-2 flex flex-wrap gap-1.5">{characterActions}</div> : null}
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
            No character sheet yet. The Planner can add one later.
          </p>
        )}
      </section>

      <section>
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#f2c477]">
            Chapter summaries
          </h3>
          <span className="font-mono text-[10px] text-muted-foreground">
            {outline.chapters.filter((chapter) => chapter.summary).length}/
            {outline.chapters.filter((chapter) => chapter.kind === "chapter").length}
          </span>
        </div>
        <ol className="mt-2 space-y-3">
          {outline.chapters.map((chapter) => {
            const illustration = chapter.kind === "illustration";
            return (
              <li key={chapter.number} className="border-l border-border pl-3">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-primary/80">
                    {illustration ? "Plate" : `Ch. ${chapterDisplayNumber(chapter)}`}
                  </span>
                  <span className="text-[12.5px] font-medium text-foreground/90">
                    {illustration ? "Illustration page" : chapterDisplayTitle(chapter)}
                  </span>
                  {chapter.summaryStale ? (
                    <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-[#f2937f]">
                      stale
                    </span>
                  ) : null}
                  {onDeletePage ? (
                    <span className="ml-auto">
                      <DeletePageButton
                        page={chapter}
                        compact
                        deleting={deletingPageNumber === chapter.number}
                        onDelete={onDeletePage}
                      />
                    </span>
                  ) : null}
                </div>
                <p
                  className={cn(
                    "mt-1 whitespace-pre-wrap leading-relaxed text-muted-foreground",
                    compact ? "text-[11px]" : "text-[12px]",
                  )}
                >
                  {illustration
                    ? chapter.image?.prompt || "No illustration generated yet."
                    : chapter.summary ||
                      (chapter.status === "summary_skipped"
                        ? "Summary skipped for this chapter."
                        : "No summary yet.")}
                </p>
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}
