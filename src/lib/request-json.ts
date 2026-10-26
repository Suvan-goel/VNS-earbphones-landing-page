/** Parse small JSON objects without buffering an unbounded public request. */
export async function readJsonObject(req: Request, maxBytes = 16 * 1024): Promise<
  | { body: Record<string, unknown>; response?: never }
  | { body?: never; response: Response }
> {
  const fail = (status: number, message: string) => ({
    response: Response.json({ status: "error", message }, { status }),
  });

  if (req.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
    return fail(415, "Please send a JSON request.");
  }
  if (Number(req.headers.get("content-length")) > maxBytes) {
    return fail(413, "That request is too large.");
  }
  if (!req.body) return fail(400, "Invalid request.");

  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        return fail(413, "That request is too large.");
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    const body: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    if (!body || typeof body !== "object" || Array.isArray(body)) return fail(400, "Invalid request.");
    return { body: body as Record<string, unknown> };
  } catch {
    return fail(400, "Invalid request.");
  } finally {
    reader.releaseLock();
  }
}
