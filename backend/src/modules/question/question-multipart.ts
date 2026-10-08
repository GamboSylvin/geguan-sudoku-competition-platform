/**
 * A minimal `multipart/form-data` reader (Unit 05's import endpoint).
 *
 * **Zero dependencies**, for the same reason as `question-xlsx.ts`: `code-standards.md`'s
 * Dependencies section says to prefer built-in solutions and to ask before adding a
 * package, and no project document ever decided on an upload middleware. The request
 * body arrives as one `Buffer` (see `question.controller.ts`'s `express.raw`), and
 * this walks its boundaries directly.
 *
 * Only what the import endpoint needs is supported: one file part, its filename and
 * content type, and its bytes. Chunked transfer-encoding is not handled (Express has
 * already buffered the body by the time this runs), and no part other than the file
 * is read.
 */

interface MultipartPart {
  /** The `name` of the form field, e.g. `file`. */
  field: string;
  /** The `filename` of the form field, when it is a file part. */
  filename: string | null;
  contentType: string | null;
  body: Buffer;
}

/**
 * Split one buffered multipart body into its parts.
 *
 * `boundary` is the value Express reports after `multipart/form-data; boundary=…`;
 * it may arrive quoted. Throws when the body doesn't look like a multipart message
 * at all — the controller turns that into a 422, since it is the client's request
 * that is malformed.
 */
export function parseMultipart(body: Buffer, boundary: string): MultipartPart[] {
  const delimiter = Buffer.from(`--${boundary.replace(/^"|"$/g, "")}`);
  const parts: MultipartPart[] = [];

  let cursor = body.indexOf(delimiter);
  if (cursor < 0) {
    throw new Error("not a multipart body");
  }

  while (cursor >= 0) {
    const afterDelimiter = cursor + delimiter.length;
    // A boundary is either followed by `\r\n` (another part) or `--` (the end).
    if (body.subarray(afterDelimiter, afterDelimiter + 2).toString("latin1") === "--") break;

    const headerStart = afterDelimiter + 2; // skip the CRLF
    const headerEnd = body.indexOf("\r\n\r\n", headerStart);
    if (headerEnd < 0) break;

    const contentStart = headerEnd + 4;
    const nextBoundary = body.indexOf(delimiter, contentStart);
    // The body of a part ends with the CRLF that precedes the next boundary.
    const contentEnd = nextBoundary < 0 ? body.length : nextBoundary - 2;

    const headers = body.subarray(headerStart, headerEnd).toString("utf8");
    const disposition = /content-disposition:[^\r\n]*/i.exec(headers)?.[0] ?? "";
    parts.push({
      field: /name="([^"]*)"/i.exec(disposition)?.[1] ?? "",
      filename: /filename="([^"]*)"/i.exec(disposition)?.[1] ?? null,
      contentType: /content-type:\s*([^\r\n]*)/i.exec(headers)?.[1]?.trim() ?? null,
      body: body.subarray(contentStart, Math.max(contentStart, contentEnd)),
    });

    cursor = nextBoundary;
  }

  return parts;
}

/** The one uploaded file of an import request, or `null` when there isn't one. */
export function readUploadedFile(
  body: Buffer,
  boundary: string,
): { filename: string; mimeType: string; bytes: Buffer } | null {
  const filePart = parseMultipart(body, boundary).find((part) => part.filename !== null);
  if (!filePart) return null;
  return {
    filename: filePart.filename ?? "upload.xlsx",
    mimeType: filePart.contentType ?? "application/octet-stream",
    bytes: filePart.body,
  };
}
