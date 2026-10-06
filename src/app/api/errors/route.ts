import { createHash } from "node:crypto";

// Per-instance burst protection, not a replacement for platform DDoS protection.
const reports = new Map<string, { count: number; until: number }>();
export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin) return new Response(null, { status: 403 });
  if (!request.headers.get("content-type")?.startsWith("application/json")) return new Response(null, { status: 415 });
  const key = createHash("sha256").update(request.headers.get("x-forwarded-for") ?? "unknown").digest("hex");
  const now = Date.now();
  for (const [id, value] of reports) if (value.until < now) reports.delete(id);
  const current = reports.get(key) ?? { count: 0, until: now + 60_000 };
  if (current.count >= 5 || reports.size >= 1000) return new Response(null, { status: 429 });
  current.count++; reports.set(key, current);
  // Bound the actual streamed body, not just a client-controlled content-length.
  const reader = request.body?.getReader();
  if (!reader) return new Response(null, { status: 400 });
  let body = "";
  const decoder = new TextDecoder();
  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;
    body += decoder.decode(chunk.value, { stream: true });
    if (body.length > 4096) { await reader.cancel(); return new Response(null, { status: 413 }); }
  }
  try {
    const data = JSON.parse(body);
    if (typeof data.name !== "string" || !/^[\w ]{1,60}$/.test(data.name)) throw new Error();
    const frames = Array.isArray(data.frames) ? data.frames.filter((v: unknown) => typeof v === "string" && /^\/_next\/static\/[\w/.-]+:\d+:\d+$/.test(v)).slice(0, 8) : [];
    const digest = typeof data.digest === "string" && /^\w{1,80}$/.test(data.digest) ? data.digest : undefined;
    console.error(JSON.stringify({ event: "client_crash", name: data.name, frames, digest,
      release: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) }));
    return new Response(null, { status: 204 });
  } catch { return new Response(null, { status: 400 }); }
}
