import { z } from "zod";
import { assertSameOrigin, errorResponse, jsonOk, parseBody } from "@/lib/api";
import { testConnection } from "@/lib/ai/client";
import { normalizeBaseUrl, resolveEndpoints } from "@/lib/ai/urls";
import { getConfig } from "@/lib/storage/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  baseUrl: z.string().min(1).max(2_000),
  apiKey: z.string().max(4_000).optional(),
  providerId: z.string().max(100).optional(),
});

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const input = await parseBody(request, schema);
    const baseUrl = normalizeBaseUrl(input.baseUrl);
    resolveEndpoints(baseUrl);
    const config = await getConfig();
    const existing = input.providerId
      ? config?.providers.find((provider) => provider.id === input.providerId)
      : undefined;
    const apiKey = input.apiKey?.trim() ? input.apiKey.trim() : existing?.apiKey ?? "";

    return jsonOk(await testConnection(baseUrl, apiKey));
  } catch (error) {
    return errorResponse(error);
  }
}
