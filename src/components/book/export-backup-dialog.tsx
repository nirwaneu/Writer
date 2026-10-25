"use client";

import { Download, ImageOff } from "lucide-react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

export function ExportBackupDialog({
  open,
  onOpenChange,
  slug,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  slug: string;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Export book backup?</AlertDialogTitle>
          <AlertDialogDescription>
            This downloads the book metadata, outline, model and preset selections, chapters,
            manuscript text, and chat history as a JSON file.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="flex items-start gap-2.5 rounded-md border border-[#5b431c] bg-[#1b1409] p-3 text-[11.5px] leading-relaxed text-[#c9a86e]">
          <ImageOff className="mt-0.5 size-4 shrink-0" />
          <p>
            Note: Image assets are not included in this backup to keep the file size portable.
            You will need to regenerate illustrations on the new device.
          </p>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <Button asChild>
            <a href={`/api/novels/${slug}/backup`} download>
              <Download />
              Download backup
            </a>
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
