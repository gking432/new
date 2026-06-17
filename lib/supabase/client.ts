import { createBrowserClient } from "@supabase/ssr";
import { env } from "@/lib/env";

export function createClient() {
  return createBrowserClient(
    env("NEXT_PUBLIC_SUPABASE_URL")!,
    env("NEXT_PUBLIC_SUPABASE_ANON_KEY")!
  );
}

export function isSupabaseConfigured() {
  return Boolean(
    env("NEXT_PUBLIC_SUPABASE_URL") && env("NEXT_PUBLIC_SUPABASE_ANON_KEY")
  );
}
