/**
 * Read an environment variable at runtime.
 *
 * Bracket access prevents Next.js from inlining NEXT_PUBLIC_* values at build
 * time. Dot access (process.env.NEXT_PUBLIC_FOO) is replaced with whatever was
 * present during the build; bracket access reads the running server's env
 * (e.g. Vercel variables that exist at runtime but were missing during CI).
 */
export function env(name: string): string | undefined {
  return process.env[name];
}
