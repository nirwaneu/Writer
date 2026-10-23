import { errorResponse, jsonOk } from "@/lib/api";
import { listModels } from "@/lib/ai/client";
import { formatModelValue } from "@/lib/ai/routing";
import { getConfig } from "@/lib/storage/config";
import type { ModelOption, ProviderModelGroup } from "@/lib/ai/model-options";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const config = await getConfig();
    const providers = config?.providers ?? [];

    const groups = await Promise.all(
      providers.map(async (provider): Promise<ProviderModelGroup> => {
        try {
          const { models } = await listModels(provider.baseUrl, provider.apiKey);
          return {
            providerId: provider.id,
            providerName: provider.name,
            models,
            error: null,
          };
        } catch (error) {
          return {
            providerId: provider.id,
            providerName: provider.name,
            models: [],
            error: error instanceof Error ? error.message : "Could not list models.",
          };
        }
      }),
    );

    const options: ModelOption[] = groups.flatMap((group) =>
      group.models.map((model) => ({
        value: formatModelValue(group.providerId, model),
        providerId: group.providerId,
        providerName: group.providerName,
        model,
        label: `[${group.providerName}] ${model}`,
      })),
    );

    return jsonOk({ groups, options });
  } catch (error) {
    return errorResponse(error);
  }
}
