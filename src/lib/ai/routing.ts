import type { AppConfig, Provider } from "@/lib/schemas";
import { AppError } from "@/lib/errors";

export function parseModelValue(value: string): { providerId?: string; model: string } {
  const index = value.indexOf("|");
  if (index > 0) {
    return { providerId: value.slice(0, index), model: value.slice(index + 1) };
  }
  return { model: value };
}

export function formatModelValue(providerId: string, model: string): string {
  return `${providerId}|${model}`;
}

export function modelDisplayId(value: string): string {
  return parseModelValue(value).model;
}

export function modelDisplayLabel(
  providers: Array<Pick<Provider, "id" | "name">>,
  value: string,
): string {
  const { providerId, model } = parseModelValue(value);
  const provider = providerId
    ? providers.find((item) => item.id === providerId)
    : providers[0];
  return provider ? `[${provider.name}] ${model}` : model;
}

export function resolveModelRoute(
  config: AppConfig,
  value: string,
): { provider: Provider; model: string } {
  const { providerId, model } = parseModelValue(value.trim());
  const provider = providerId
    ? config.providers.find((item) => item.id === providerId)
    : config.providers[0];

  if (!provider) {
    throw new AppError(
      "AI_NOT_CONFIGURED",
      providerId
        ? "The provider for this model was removed. Choose a new model in Book settings."
        : "Add an API connection before generating.",
      { status: 428 },
    );
  }
  if (!model) {
    throw new AppError("AI_NOT_CONFIGURED", "Choose a model for this role in Book settings.", {
      status: 428,
    });
  }

  return { provider, model };
}
