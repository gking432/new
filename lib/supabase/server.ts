import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

/**
 * Server-side Supabase client for the app.
 *
 * This is a no-login portfolio demo: there are no real users and no real
 * data, so the whole app runs server-side on the service-role key, which
 * bypasses Row Level Security. That's why visitors land straight on the
 * dashboard + tutorial with no sign-in step. When the service-role key is
 * absent we fall back to the anon cookie client so public pages still render.
 */
export async function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (url && serviceKey) {
    return createSupabaseClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }

  const cookieStore = await cookies();
  return createServerClient(
    url!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component; nothing to persist without auth.
          }
        },
      },
    }
  );
}

export function isSupabaseConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

/**
 * Whether the no-login app can reach a database at all: it needs the project
 * URL plus either the service-role key (preferred) or the anon key. When false,
 * the app shows a setup notice instead of crashing on a missing Supabase client.
 */
export function isAppConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  );
}
