import { assertSameOrigin, errorResponse, jsonOk, parseBody } from "@/lib/api";
import { bookBackupSchema, importBookBackup } from "@/lib/storage/backup";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const input = await parseBody(request, bookBackupSchema);
    const result = await importBookBackup(input);
    return jsonOk({ slug: result.slug, outline: result.outline }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
