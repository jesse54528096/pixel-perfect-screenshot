import { createClient } from "@supabase/supabase-js";

// Service-role client for the /api functions only. It bypasses RLS, so it must never be
// imported from src/ (the browser bundle). The underscore keeps Vercel from routing it.
const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;

if (!url || !key) {
  throw new Error("Missing SUPABASE_URL/VITE_SUPABASE_URL or SUPABASE_SECRET_KEY.");
}

export const supabaseAdmin = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});
