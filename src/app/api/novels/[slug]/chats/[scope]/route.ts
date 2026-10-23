import { z } from "zod";
import { assertSameOrigin, errorResponse, jsonOk, parseBody } from "@/lib/api";
import { AppError } from "@/lib/errors";
import {
  appendNovelChatMessage,
  readNovelChat,
} from "@/lib/storage/chats";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ slug: string; scope: string }> };

function parseScope(raw: string): "premise" | number {
  if (raw === "premise") return "premise";
  const number = Number(raw);
  if (!Number.isInteger(number) || number < 1) {
    throw new AppError("BAD_REQUEST", "Invalid chat scope.", { status: 400 });
  }
  return number;
}

export async function GET(_request: Request, { params }: Params) {
  try {
    const { slug, scope: rawScope } = await params;
    const chat = await readNovelChat(slug, parseScope(rawScope));
    return jsonOk({ chat });
  } catch (error) {
    return errorResponse(error);
  }
}

const messageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(200_000),
});

export async function POST(request: Request, { params }: Params) {
  try {
    assertSameOrigin(request);
    const { slug, scope: rawScope } = await params;
    const input = await parseBody(request, messageSchema);
    const chat = await appendNovelChatMessage(slug, parseScope(rawScope), {
      id: crypto.randomUUID(),
      role: input.role,
      content: input.content,
      createdAt: new Date().toISOString(),
    });
    return jsonOk({ chat }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
