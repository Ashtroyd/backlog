import { createClient } from "@supabase/supabase-js";

/**
 * Browser Supabase client (shared with SSR, where it is inert).
 * The session persists in localStorage and is scoped to this app's data
 * by Row Level Security on the `items` table.
 */
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);
