import { randomUUID } from "node:crypto";
import { asc, eq, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { meta, surgicalPresets } from "@/lib/db/schema";
import { NotFoundError } from "@/lib/errors";
import { DEFAULT_SURGICAL_PRESETS } from "@/lib/surgical/defaults";
import type {
  SurgicalPreset,
  SurgicalPresetInput,
  SurgicalPresetUpdateInput,
} from "@/lib/schemas";

const now = () => new Date().toISOString();
const SEEDED_KEY = "surgical_presets_seeded";

function rowToPreset(row: typeof surgicalPresets.$inferSelect): SurgicalPreset {
  return {
    id: row.id,
    label: row.label,
    icon: row.icon,
    instruction: row.instruction,
    sortOrder: row.sortOrder,
    active: row.active,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function listSurgicalPresets(activeOnly = false): Promise<SurgicalPreset[]> {
  const db = await getDb();
  const rows = db
    .select()
    .from(surgicalPresets)
    .orderBy(asc(surgicalPresets.sortOrder), asc(surgicalPresets.createdAt))
    .all();
  return rows.map(rowToPreset).filter((preset) => !activeOnly || preset.active);
}

export async function createSurgicalPreset(
  input: SurgicalPresetInput,
): Promise<SurgicalPreset> {
  const db = await getDb();
  const max = db
    .select({ value: sql<number>`coalesce(max(sort_order), -1)` })
    .from(surgicalPresets)
    .get();
  const timestamp = now();
  const preset: SurgicalPreset = {
    id: randomUUID(),
    label: input.label.trim(),
    icon: input.icon.trim(),
    instruction: input.instruction.trim(),
    sortOrder: Number(max?.value ?? -1) + 1,
    active: input.active,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  db.insert(surgicalPresets).values(preset).run();
  return preset;
}

export async function updateSurgicalPreset(
  id: string,
  input: SurgicalPresetUpdateInput,
): Promise<SurgicalPreset> {
  const db = await getDb();
  const existing = db
    .select()
    .from(surgicalPresets)
    .where(eq(surgicalPresets.id, id))
    .get();
  if (!existing) throw new NotFoundError("That preset does not exist.");

  const updatedAt = now();
  db.update(surgicalPresets)
    .set({
      ...(input.label !== undefined ? { label: input.label.trim() } : {}),
      ...(input.icon !== undefined ? { icon: input.icon.trim() } : {}),
      ...(input.instruction !== undefined ? { instruction: input.instruction.trim() } : {}),
      ...(input.active !== undefined ? { active: input.active } : {}),
      updatedAt,
    })
    .where(eq(surgicalPresets.id, id))
    .run();

  return rowToPreset({
    ...existing,
    ...(input.label !== undefined ? { label: input.label.trim() } : {}),
    ...(input.icon !== undefined ? { icon: input.icon.trim() } : {}),
    ...(input.instruction !== undefined ? { instruction: input.instruction.trim() } : {}),
    ...(input.active !== undefined ? { active: input.active } : {}),
    updatedAt,
  });
}

export async function deleteSurgicalPreset(id: string): Promise<void> {
  const db = await getDb();
  const existing = db
    .select({ id: surgicalPresets.id })
    .from(surgicalPresets)
    .where(eq(surgicalPresets.id, id))
    .get();
  if (!existing) throw new NotFoundError("That preset does not exist.");
  db.delete(surgicalPresets).where(eq(surgicalPresets.id, id)).run();
}

export async function reorderSurgicalPresets(ids: string[]): Promise<SurgicalPreset[]> {
  const db = await getDb();
  const timestamp = now();
  db.transaction((tx) => {
    ids.forEach((id, index) => {
      tx.update(surgicalPresets)
        .set({ sortOrder: index, updatedAt: timestamp })
        .where(eq(surgicalPresets.id, id))
        .run();
    });
  });
  return listSurgicalPresets();
}

export async function resetSurgicalPresets(): Promise<SurgicalPreset[]> {
  const db = await getDb();
  const timestamp = now();
  db.transaction((tx) => {
    tx.delete(surgicalPresets).run();
    for (const preset of DEFAULT_SURGICAL_PRESETS) {
      tx.insert(surgicalPresets)
        .values({
          id: preset.id,
          label: preset.label,
          icon: preset.icon,
          instruction: preset.instruction,
          sortOrder: preset.sortOrder,
          active: true,
          createdAt: timestamp,
          updatedAt: timestamp,
        })
        .run();
    }
    tx.insert(meta)
      .values({ key: SEEDED_KEY, value: "1" })
      .onConflictDoUpdate({ target: meta.key, set: { value: "1" } })
      .run();
  });
  return listSurgicalPresets();
}