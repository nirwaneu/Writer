export function parseSurgicalTakes(raw: string): string[] {
  const cleaned = raw.replace(/```json/gi, "").replace(/```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  const candidate = start >= 0 && end > start ? cleaned.slice(start, end + 1) : cleaned;

  try {
    const parsed = JSON.parse(candidate) as { takes?: unknown };
    if (Array.isArray(parsed.takes)) {
      const takes = parsed.takes
        .filter((take): take is string => typeof take === "string" && take.trim().length > 0)
        .map((take) => take.trim())
        .slice(0, 2);
      if (takes.length) return takes;
    }
  } catch {
    // Fall through to the delimiter parser.
  }

  return cleaned
    .split(/\n\s*(?:-{3,}|TAKE\s*[12]\s*:?)\s*\n/i)
    .map((take) => take.trim())
    .filter(Boolean)
    .slice(0, 2);
}