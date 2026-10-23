"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, Loader2, Plus, SquarePen } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function AddPageMenu({ slug }: { slug: string }) {
  const router = useRouter();
  const [pending, setPending] = useState<"chapter" | "illustration" | null>(null);

  async function addPage(kind: "chapter" | "illustration") {
    if (pending) return;
    setPending(kind);
    try {
      const response = await fetch(`/api/novels/${slug}/pages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind }),
      });
      const payload = (await response.json()) as {
        pageNumber?: number;
        error?: { message?: string };
      };
      if (!response.ok || !payload.pageNumber) {
        toast.error(payload.error?.message || "The page could not be added.");
        return;
      }
      toast.success(kind === "illustration" ? "Illustration page added." : "Chapter added.");
      router.push(`/novels/${slug}/write?chapter=${payload.pageNumber}`);
      router.refresh();
    } catch {
      toast.error("Could not reach the app server.");
    } finally {
      setPending(null);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="secondary" disabled={Boolean(pending)}>
          {pending ? <Loader2 className="animate-spin" /> : <Plus />}
          Add page
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => void addPage("chapter")} disabled={Boolean(pending)}>
          <SquarePen />
          Add chapter
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => void addPage("illustration")}
          disabled={Boolean(pending)}
        >
          <ImagePlus />
          Add illustration page
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
