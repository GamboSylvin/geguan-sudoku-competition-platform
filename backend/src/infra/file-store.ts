import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { env } from "../config/env";

/**
 * The disk file store (BLD-001). Uploaded and generated files (participant Excel,
 * question PDF, credential slips, exports) live on the server's disk, in a mounted
 * folder — not in object storage and not in the database.
 *
 * Path template (data-model.md, "Storage conventions"):
 *   {STORAGE_ROOT}/competitions/{competitionId}/{kind}/{fileId}-{originalName}
 *
 * Only the path convention and the root are set up in Unit 01; the import and
 * export units use it. `kind` is a plain string here so this adapter stays free of
 * domain rules; the `StoredFile.kind` enum lives in the data model.
 */
export function competitionFilePath(params: {
  competitionId: string;
  kind: string;
  fileId: string;
  originalName: string;
}): string {
  const { competitionId, kind, fileId, originalName } = params;
  return join(
    env.STORAGE_ROOT,
    "competitions",
    competitionId,
    kind,
    `${fileId}-${originalName}`,
  );
}

export async function ensureStorageRoot(): Promise<void> {
  await mkdir(env.STORAGE_ROOT, { recursive: true });
}
