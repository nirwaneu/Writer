"use client";

import { useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
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
import type { Character } from "@/lib/schemas";

export function CharacterEditorDialog({
  open,
  onOpenChange,
  initial,
  saving,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial: Character[];
  saving: boolean;
  onSave: (characters: Character[]) => void;
}) {
  const [characters, setCharacters] = useState<Character[]>(initial);

  function update(index: number, patch: Partial<Character>) {
    setCharacters((current) =>
      current.map((character, itemIndex) =>
        itemIndex === index ? { ...character, ...patch } : character,
      ),
    );
  }

  function add() {
    setCharacters((current) => [
      ...current,
      { name: "", role: "", description: "" },
    ]);
  }

  function remove(index: number) {
    setCharacters((current) => current.filter((_, itemIndex) => itemIndex !== index));
  }

  const valid = characters.every((character) => character.name.trim());

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit characters</DialogTitle>
          <DialogDescription>
            Characters here are copied into the Story Vault and sent to the Planner and
            Executor with every call.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {characters.length ? (
            characters.map((character, index) => (
              <div
                key={index}
                className="space-y-2 rounded-md border border-border bg-[#0c1218] p-3"
              >
                <div className="flex items-end gap-2">
                  <div className="flex-1 space-y-1.5">
                    <Label htmlFor={`character-name-${index}`}>Name</Label>
                    <Input
                      id={`character-name-${index}`}
                      value={character.name}
                      onChange={(event) => update(index, { name: event.target.value })}
                      maxLength={120}
                      placeholder="Mara"
                    />
                  </div>
                  <div className="flex-1 space-y-1.5">
                    <Label htmlFor={`character-role-${index}`}>Role</Label>
                    <Input
                      id={`character-role-${index}`}
                      value={character.role}
                      onChange={(event) => update(index, { role: event.target.value })}
                      maxLength={200}
                      placeholder="protagonist"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => remove(index)}
                    aria-label={`Remove ${character.name || "character"}`}
                    className="text-muted-foreground hover:text-[#f2937f]"
                  >
                    <Trash2 />
                  </Button>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`character-description-${index}`}>Description</Label>
                  <Textarea
                    id={`character-description-${index}`}
                    value={character.description}
                    onChange={(event) =>
                      update(index, { description: event.target.value })
                    }
                    maxLength={4_000}
                    className="min-h-16 text-[12px]"
                    placeholder="What they want, what they hide, how they changed."
                  />
                </div>
              </div>
            ))
          ) : (
            <p className="rounded-md border border-dashed border-border p-4 text-[12px] text-muted-foreground">
              No characters yet. Add one manually or let the Planner extract them.
            </p>
          )}

          <Button type="button" variant="secondary" size="sm" onClick={add}>
            <Plus />
            Add character
          </Button>
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button
            onClick={() => onSave(characters.map((character) => ({
              name: character.name.trim(),
              role: character.role.trim(),
              description: character.description.trim(),
            })))}
            disabled={saving || !valid}
          >
            {saving ? <Loader2 className="animate-spin" /> : null}
            {saving ? "Saving…" : "Save characters"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
