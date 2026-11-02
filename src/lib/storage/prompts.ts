import { getDb } from "@/lib/db";
import { promptTemplates } from "@/lib/db/schema";
import {
  PROMPT_DEFINITIONS,
  resolveRolePrompt,
  type PromptMap,
} from "@/lib/ai/prompt-definitions";

export { resolveRolePrompt };
export type { PromptMap };

export async function getPromptMap(): Promise<PromptMap> {
  const db = await getDb();
  const rows = db.select().from(promptTemplates).all();
  const byKey = new Map(rows.map((row) => [row.key, row]));
  const timestamp = new Date().toISOString();
  const map = {} as PromptMap;
  const missing: Array<{ key: string; value: string; updatedAt: string }> = [];

  for (const definition of PROMPT_DEFINITIONS) {
    const row = byKey.get(definition.key);
    const value = row?.value?.trim() ? row.value : definition.defaultValue;
    map[definition.key] = value;
    if (!row || !row.value?.trim()) {
      missing.push({
        key: definition.key,
        value: definition.defaultValue,
        updatedAt: timestamp,
      });
    }
  }

  for (const item of missing) {
    db.insert(promptTemplates)
      .values(item)
      .onConflictDoUpdate({
        target: promptTemplates.key,
        set: { value: item.value, updatedAt: item.updatedAt },
      })
      .run();
  }

  return map;
}

export async function savePromptMap(input: Partial<Record<string, string>>): Promise<PromptMap> {
  const db = await getDb();
  const timestamp = new Date().toISOString();

  for (const definition of PROMPT_DEFINITIONS) {
    const value = input[definition.key];
    if (typeof value !== "string") continue;
    const next = value.trim() ? value : definition.defaultValue;
    db.insert(promptTemplates)
      .values({ key: definition.key, value: next, updatedAt: timestamp })
      .onConflictDoUpdate({
        target: promptTemplates.key,
        set: { value: next, updatedAt: timestamp },
      })
      .run();
  }

  return getPromptMap();
}