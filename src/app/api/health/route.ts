import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export async function GET() {
  const started = Date.now();
  try {
    const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error } = await db.from("profiles").select("id", { head: true }).limit(1)
      .abortSignal(AbortSignal.timeout(5000));
    if (error) throw error;
    return Response.json({ status: "ok", database: "reachable", ms: Date.now() - started }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    console.error(JSON.stringify({ event: "health_check_failed", dependency: "database" }));
    return Response.json({ status: "degraded", database: "unreachable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
