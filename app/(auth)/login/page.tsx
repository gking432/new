"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Compass, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";

const DEMO_ACCOUNTS = [
  { label: "Demo Admin", email: "admin@northstar-demo.com" },
  { label: "Demo Sales Rep", email: "sales@northstar-demo.com" },
];

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const configured = isSupabaseConfigured();

  async function signIn(signInEmail: string, signInPassword: string) {
    if (!configured) {
      toast.error("Supabase is not configured. See the README for setup steps.");
      return;
    }
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: signInEmail,
      password: signInPassword,
    });
    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }
    router.push("/app");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <Link href="/" className="inline-flex items-center gap-2">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Compass className="h-5 w-5" />
            </span>
          </Link>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight">Command Center</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Northstar Exterior &amp; Home — internal team login
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Sign in</CardTitle>
            <CardDescription>Use your team credentials to continue.</CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                signIn(email, password);
              }}
            >
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@northstar-demo.com"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Sign in
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="border-dashed">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Demo credentials</CardTitle>
            <CardDescription className="text-xs">
              Seeded by <code>npm run seed</code> — password is{" "}
              <code className="font-mono">demo-password</code>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {DEMO_ACCOUNTS.map((account) => (
              <div
                key={account.email}
                className="flex items-center justify-between rounded-md border bg-secondary/40 px-3 py-2"
              >
                <div>
                  <p className="text-sm font-medium">{account.label}</p>
                  <p className="text-xs text-muted-foreground">{account.email}</p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={loading}
                  onClick={() => signIn(account.email, "demo-password")}
                >
                  Use
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>

        {!configured && (
          <p className="text-center text-xs text-muted-foreground">
            Supabase environment variables are not set. Copy{" "}
            <code>.env.example</code> to <code>.env.local</code> and follow the
            README setup steps.
          </p>
        )}
      </div>
    </div>
  );
}
