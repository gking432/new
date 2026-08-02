/**
 * The public portfolio build is self-contained by default. Set
 * DEMO_STORAGE=supabase to opt back into the shared database implementation.
 */
export function isLocalDemoMode() {
  return process.env.DEMO_STORAGE !== "supabase";
}
