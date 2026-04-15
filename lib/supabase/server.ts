import { createClient, SupabaseClient } from "@supabase/supabase-js";

/** Private bucket — access via service role + signed URLs from API routes only. */
export const MEETING_MATERIALS_BUCKET = "meeting-materials";

/**
 * Server-only Supabase client (service role). Requires:
 * - NEXT_PUBLIC_SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY (never expose to the browser)
 *
 * Create the bucket `meeting-materials` in the Supabase dashboard (private).
 */
export function createSupabaseAdmin(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function isSupabaseConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}
