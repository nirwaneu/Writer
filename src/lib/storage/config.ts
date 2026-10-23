import { asc, eq, notInArray } from "drizzle-orm";
import {
  appConfigSchema,
  type AppConfig,
  type Preset,
  type Provider,
  type PublicAppConfig,
} from "@/lib/schemas";
import { AppError } from "@/lib/errors";
import { getDb } from "@/lib/db";
import {
  globalSettings,
  presets as presetsTable,
  providers as providersTable,
} from "@/lib/db/schema";
import { normalizeConfig } from "@/lib/presets/defaults";
import { DEFAULT_PRESET_ID } from "@/lib/presets/constants";

function rowToPreset(row: typeof presetsTable.$inferSelect): Preset {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    builtIn: row.builtIn,
    roles: row.rolesJson,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function rowToProvider(row: typeof providersTable.$inferSelect): Provider {
  return {
    id: row.id,
    name: row.name,
    baseUrl: row.baseUrl,
    apiKey: row.apiKey,
    connection: {
      ok: row.connectionOk,
      ...(row.connectionCheckedAt ? { checkedAt: row.connectionCheckedAt } : {}),
      ...(row.connectionLatencyMs !== null
        ? { latencyMs: row.connectionLatencyMs }
        : {}),
      ...(row.connectionDetail ? { detail: row.connectionDetail } : {}),
    },
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function createEmptyConfig(): AppConfig {
  const timestamp = new Date().toISOString();
  return {
    version: 1,
    baseUrl: "",
    apiKey: "",
    models: { planner: "", executor: "", summarizer: "" },
    connection: { ok: false },
    presets: [],
    providers: [],
    defaultPresetId: DEFAULT_PRESET_ID,
    updatedAt: timestamp,
  };
}

export async function getConfig(): Promise<AppConfig | null> {
  const db = await getDb();
  const row = db
    .select()
    .from(globalSettings)
    .where(eq(globalSettings.id, 1))
    .get();
  if (!row) return null;

  const [presetRows, providerRows] = await Promise.all([
    db.select().from(presetsTable).orderBy(presetsTable.createdAt).all(),
    db.select().from(providersTable).orderBy(asc(providersTable.createdAt)).all(),
  ]);
  const providers = providerRows.map(rowToProvider);
  const first = providers[0];

  const config = appConfigSchema.parse({
    version: 1,
    baseUrl: row.baseUrl || first?.baseUrl || "",
    apiKey: row.apiKey || first?.apiKey || "",
    models: {
      planner: row.plannerModel,
      executor: row.executorModel,
      summarizer: row.summarizerModel,
    },
    connection: {
      ok: row.connectionOk,
      ...(row.connectionCheckedAt ? { checkedAt: row.connectionCheckedAt } : {}),
      ...(row.connectionLatencyMs !== null
        ? { latencyMs: row.connectionLatencyMs }
        : {}),
      ...(row.connectionDetail ? { detail: row.connectionDetail } : {}),
    },
    presets: presetRows.map(rowToPreset),
    providers,
    defaultPresetId: row.defaultPresetId,
    updatedAt: row.updatedAt,
  });

  return normalizeConfig(config);
}

export async function requireConfig(): Promise<AppConfig> {
  const config = await getConfig();
  if (!config) {
    throw new AppError("CONFIG_REQUIRED", "Connect a model provider before writing.", {
      status: 428,
    });
  }
  if (!isConfigured(config)) {
    throw new AppError(
      "AI_NOT_CONFIGURED",
      "Add a provider and choose Planner, Executor, and Summarizer models in Setup.",
      { status: 428 },
    );
  }
  return config;
}

export function isConfigured(config: AppConfig | null): config is AppConfig {
  return Boolean(
    config &&
      config.providers.length > 0 &&
      config.models.planner &&
      config.models.executor &&
      config.models.summarizer,
  );
}

export async function saveConfig(config: AppConfig): Promise<AppConfig> {
  const normalized = normalizeConfig(appConfigSchema.parse(config));
  const db = await getDb();

  db.transaction((tx) => {
    const values = {
      id: 1,
      baseUrl: normalized.baseUrl || normalized.providers[0]?.baseUrl || "",
      apiKey: normalized.apiKey || normalized.providers[0]?.apiKey || "",
      plannerModel: normalized.models.planner,
      executorModel: normalized.models.executor,
      summarizerModel: normalized.models.summarizer,
      connectionOk: normalized.connection.ok,
      connectionCheckedAt: normalized.connection.checkedAt ?? null,
      connectionLatencyMs: normalized.connection.latencyMs ?? null,
      connectionDetail: normalized.connection.detail ?? null,
      defaultPresetId: normalized.defaultPresetId,
      updatedAt: normalized.updatedAt,
    };

    tx.insert(globalSettings)
      .values(values)
      .onConflictDoUpdate({
        target: globalSettings.id,
        set: {
          baseUrl: values.baseUrl,
          apiKey: values.apiKey,
          plannerModel: values.plannerModel,
          executorModel: values.executorModel,
          summarizerModel: values.summarizerModel,
          connectionOk: values.connectionOk,
          connectionCheckedAt: values.connectionCheckedAt,
          connectionLatencyMs: values.connectionLatencyMs,
          connectionDetail: values.connectionDetail,
          defaultPresetId: values.defaultPresetId,
          updatedAt: values.updatedAt,
        },
      })
      .run();

    const providerIds = normalized.providers.map((provider) => provider.id);
    if (providerIds.length) {
      tx.delete(providersTable)
        .where(notInArray(providersTable.id, providerIds))
        .run();
    } else {
      tx.delete(providersTable).run();
    }

    for (const provider of normalized.providers) {
      const providerValues = {
        id: provider.id,
        name: provider.name,
        baseUrl: provider.baseUrl,
        apiKey: provider.apiKey,
        connectionOk: provider.connection.ok,
        connectionCheckedAt: provider.connection.checkedAt ?? null,
        connectionLatencyMs: provider.connection.latencyMs ?? null,
        connectionDetail: provider.connection.detail ?? null,
        createdAt: provider.createdAt,
        updatedAt: provider.updatedAt,
      };
      tx.insert(providersTable)
        .values(providerValues)
        .onConflictDoUpdate({
          target: providersTable.id,
          set: {
            name: providerValues.name,
            baseUrl: providerValues.baseUrl,
            apiKey: providerValues.apiKey,
            connectionOk: providerValues.connectionOk,
            connectionCheckedAt: providerValues.connectionCheckedAt,
            connectionLatencyMs: providerValues.connectionLatencyMs,
            connectionDetail: providerValues.connectionDetail,
            updatedAt: providerValues.updatedAt,
          },
        })
        .run();
    }

    const presetIds = normalized.presets.map((preset) => preset.id);
    if (presetIds.length) {
      tx.delete(presetsTable)
        .where(notInArray(presetsTable.id, presetIds))
        .run();
    }

    for (const preset of normalized.presets) {
      const presetValues = {
        id: preset.id,
        name: preset.name,
        description: preset.description,
        builtIn: preset.builtIn,
        rolesJson: preset.roles,
        createdAt: preset.createdAt,
        updatedAt: preset.updatedAt,
      };
      tx.insert(presetsTable)
        .values(presetValues)
        .onConflictDoUpdate({
          target: presetsTable.id,
          set: {
            name: presetValues.name,
            description: presetValues.description,
            builtIn: presetValues.builtIn,
            rolesJson: presetValues.rolesJson,
            updatedAt: presetValues.updatedAt,
          },
        })
        .run();
    }
  });

  return normalized;
}

export function toPublicConfig(config: AppConfig | null): PublicAppConfig | null {
  if (!config) return null;
  return {
    providers: config.providers.map((provider) => {
      const hint = provider.apiKey ? provider.apiKey.slice(-4) : null;
      return {
        id: provider.id,
        name: provider.name,
        baseUrl: provider.baseUrl,
        hasApiKey: Boolean(provider.apiKey),
        apiKeyHint: hint ? `••••${hint}` : null,
        connection: provider.connection,
        createdAt: provider.createdAt,
        updatedAt: provider.updatedAt,
      };
    }),
    models: config.models,
    updatedAt: config.updatedAt,
  };
}
