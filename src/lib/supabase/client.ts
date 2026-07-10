import { getBrowserSupabaseClient } from "@/lib/supabase/browser-client";

export function createClient() {
  return getBrowserSupabaseClient();
}
