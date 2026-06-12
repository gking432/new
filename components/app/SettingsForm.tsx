"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { updateCompanySettings } from "@/lib/actions";
import type { CompanySettings } from "@/types/app";

export function SettingsForm({ settings }: { settings: CompanySettings }) {
  const [form, setForm] = useState({
    company_name: settings.company_name,
    phone: settings.phone ?? "",
    email: settings.email ?? "",
    service_area: settings.service_area ?? "",
    timezone: settings.timezone,
    ai_enabled: settings.ai_enabled,
    automations_enabled: settings.automations_enabled,
    default_ai_model: settings.default_ai_model ?? "gpt-4.1-mini",
    default_tone: settings.default_tone,
  });
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    const result = await updateCompanySettings({ id: settings.id, ...form });
    setSaving(false);
    if (result.success) toast.success("Settings saved");
    else toast.error(result.error);
  }

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Company profile</CardTitle>
          <CardDescription>Shown across the command center and in generated messages.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Company name</Label>
            <Input value={form.company_name} onChange={(e) => set("company_name", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Service area</Label>
            <Input value={form.service_area} onChange={(e) => set("service_area", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Phone</Label>
            <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input value={form.email} onChange={(e) => set("email", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Timezone</Label>
            <Select value={form.timezone} onValueChange={(value) => set("timezone", value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["America/Chicago", "America/New_York", "America/Denver", "America/Los_Angeles"].map(
                  (timezone) => (
                    <SelectItem key={timezone} value={timezone}>
                      {timezone}
                    </SelectItem>
                  )
                )}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Business hours</Label>
            <p className="rounded-md border bg-secondary/30 px-3 py-2 text-sm text-muted-foreground">
              {Object.entries(settings.business_hours ?? {})
                .map(([day, hours]) => `${day.replace(/_/g, "–")}: ${hours}`)
                .join(" · ") || "Not set"}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>AI settings</CardTitle>
          <CardDescription>
            All AI calls run server-side. Drafts are always editable and labeled before use — the
            AI never contacts customers directly or makes commitments about insurance, pricing, or
            outcomes.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">AI lead analysis</p>
              <p className="text-xs text-muted-foreground">
                Classify urgency and quality, and recommend next actions on new leads.
              </p>
            </div>
            <Switch checked={form.ai_enabled} onCheckedChange={(value) => set("ai_enabled", value)} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Default model</Label>
              <Input
                value={form.default_ai_model}
                onChange={(e) => set("default_ai_model", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Default communication tone</Label>
              <Select value={form.default_tone} onValueChange={(value) => set("default_tone", value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["professional", "friendly", "urgent", "reassuring", "concise"].map((tone) => (
                    <SelectItem key={tone} value={tone}>
                      {tone}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Automation settings</CardTitle>
          <CardDescription>
            Webhook URL and secret are configured through environment variables
            (MAKE_WEBHOOK_URL / ZAPIER_WEBHOOK_URL / WEBHOOK_SECRET) so credentials never live in
            the database.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">Automation rules</p>
              <p className="text-xs text-muted-foreground">
                Run rules on lead creation, stage changes, and feedback submission.
              </p>
            </div>
            <Switch
              checked={form.automations_enabled}
              onCheckedChange={(value) => set("automations_enabled", value)}
            />
          </div>
        </CardContent>
      </Card>

      <Button onClick={save} disabled={saving}>
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        Save Settings
      </Button>
    </div>
  );
}
