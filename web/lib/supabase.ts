import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** Auth only. Tables are never read from the browser: RLS blocks the anon key on purpose. */
export const supabase: SupabaseClient | null = url && anonKey ? createClient(url, anonKey) : null;
