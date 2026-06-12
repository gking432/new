import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SettingsForm } from "@/components/app/SettingsForm";
import { getProfiles, getSettings } from "@/lib/db/queries";
import { createClient } from "@/lib/supabase/server";
import { initials } from "@/lib/utils/format";
import { ROLE_LABELS, SERVICE_LABELS } from "@/lib/utils/statuses";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const supabase = await createClient();
  const [settings, profiles] = await Promise.all([getSettings(supabase), getProfiles(supabase)]);

  return (
    <div className="grid gap-6 xl:grid-cols-3">
      <div className="xl:col-span-2">
        {settings ? (
          <SettingsForm settings={settings} />
        ) : (
          <Card>
            <CardContent className="py-12 text-center text-sm text-muted-foreground">
              No company settings found. Run the seed migration to create the default record.
            </CardContent>
          </Card>
        )}
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Service lines</CardTitle>
            <CardDescription>What the company sells. Used in lead intake and reporting.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {Object.entries(SERVICE_LABELS)
              .filter(([value]) => value !== "not_sure")
              .map(([value, label]) => (
                <Badge key={value} variant="secondary">
                  {label}
                </Badge>
              ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Team</CardTitle>
            <CardDescription>
              Role labels are stored per user. Full role-based permissions are a planned
              enhancement; for the MVP all signed-in staff share access.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {profiles.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No team members yet. Run <code>npm run seed</code> to create the demo team.
              </p>
            ) : (
              profiles.map((profile) => (
                <div key={profile.id} className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary">
                    {initials(profile.full_name)}
                  </span>
                  <div>
                    <p className="text-sm font-medium">{profile.full_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {ROLE_LABELS[profile.role] ?? profile.role}
                    </p>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
