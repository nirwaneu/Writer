export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const [{ ensureDataDirs }, { getDb }] = await Promise.all([
    import("@/lib/storage/fs"),
    import("@/lib/db"),
  ]);

  await ensureDataDirs();
  await getDb();
}
