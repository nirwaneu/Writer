"use client";

import { Loader2, Trash2 } from "lucide-react";
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { chapterDisplayNumber, pageKindLabel } from "@/lib/pages";
import type { Chapter } from "@/lib/schemas";

export function DeletePageButton({
  page,
  deleting = false,
  onDelete,
  compact = false,
}: {
  page: Chapter;
  deleting?: boolean;
  onDelete: (page: Chapter) => void;
  compact?: boolean;
}) {
  const label = page.kind === "illustration" ? "Illustration page" : pageKindLabel(page);
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size={compact ? "icon-sm" : "sm"}
          className="text-muted-foreground hover:text-[#f2937f]"
          aria-label={`Delete ${label}`}
          disabled={deleting}
        >
          {deleting ? <Loader2 className="animate-spin" /> : <Trash2 />}
          {compact ? null : "Delete"}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Delete {page.kind === "illustration" ? "illustration page" : `Chapter ${chapterDisplayNumber(page)}`}?
          </AlertDialogTitle>
          <AlertDialogDescription>
            {page.kind === "illustration"
              ? "The illustration, its prompt, and the page are removed from the book."
              : "The chapter text, chat history, and its local versions are removed. This cannot be undone."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep it</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => onDelete(page)}
            disabled={deleting}
            className="bg-[#3a1c18] text-[#f2937f] hover:bg-[#4a241e]"
          >
            {deleting ? "Deleting…" : "Delete page"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
