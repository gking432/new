"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bot, Check, Loader2, PhoneCall, Save } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useLiveCall } from "@/components/calls/CallProvider";
import { createLead, type LeadInput } from "@/lib/actions/leads";
import { cn } from "@/lib/utils";

type Fields = {
  first_name: string;
  last_name: string;
  phone: string;
  email: string;
  street_address: string;
  city: string;
  state: string;
  zip_code: string;
  service_type: LeadInput["service_type"] | "";
  active_leak: string;
  insurance_started: string;
  description: string;
};

const EMPTY: Fields = {
  first_name: "",
  last_name: "",
  phone: "",
  email: "",
  street_address: "",
  city: "",
  state: "",
  zip_code: "",
  service_type: "",
  active_leak: "",
  insurance_started: "",
  description: "",
};

const SERVICES: [LeadInput["service_type"], string][] = [
  ["roofing", "Roofing"],
  ["siding", "Siding"],
  ["windows", "Windows"],
  ["doors", "Doors"],
  ["bath", "Bath"],
  ["gutters", "Gutters"],
  ["leaf_protection", "Leaf Protection"],
  ["storm_damage", "Storm Damage"],
  ["not_sure", "Not Sure"],
];

function mapService(s?: string): Fields["service_type"] {
  if (!s) return "";
  const t = s.toLowerCase();
  if (t.includes("storm") || t.includes("hail")) return "storm_damage";
  if (t.includes("roof")) return "roofing";
  if (t.includes("window")) return "windows";
  if (t.includes("siding")) return "siding";
  if (t.includes("door")) return "doors";
  if (t.includes("bath") || t.includes("shower")) return "bath";
  if (t.includes("gutter")) return "gutters";
  if (t.includes("leaf")) return "leaf_protection";
  return "";
}

/**
 * The CRM lead form — a blank lead detail that can be filled MANUALLY (walk-ins,
 * phone notes, or if the AI is ever down) AND fills itself in real time when an
 * AI call is happening, so you literally watch the AI populate the record.
 */
export function LeadIntakeForm() {
  const router = useRouter();
  const live = useLiveCall();
  const [fields, setFields] = useState<Fields>(EMPTY);
  const [saving, setSaving] = useState(false);
  const touched = useRef<Set<keyof Fields>>(new Set());
  const [aiFilled, setAiFilled] = useState<Set<keyof Fields>>(new Set());

  const callActive =
    live && ["incoming", "dialing", "connecting", "connected", "processing"].includes(live.phase);

  // Merge live-extracted info into any field the human hasn't manually edited —
  // this is the "watch the AI fill the form" moment.
  const extracted = live?.extracted;
  useEffect(() => {
    if (!extracted) return;
    setFields((prev) => {
      const next = { ...prev };
      const filled = new Set(aiFilled);
      const set = (key: keyof Fields, value: string) => {
        if (!value || touched.current.has(key) || next[key]) return;
        (next as Record<string, string>)[key] = value;
        filled.add(key);
      };
      if (extracted["Name"]) {
        const [f, ...r] = extracted["Name"].split(/\s+/);
        set("first_name", f);
        if (r.length) set("last_name", r.join(" "));
      }
      set("phone", extracted["Phone"] ?? "");
      set("email", extracted["Email"] ?? "");
      set("street_address", extracted["Address"] ?? "");
      set("city", extracted["City"] ?? "");
      const svc = mapService(extracted["Service"]);
      if (svc && !touched.current.has("service_type") && !next.service_type) {
        next.service_type = svc;
        filled.add("service_type");
      }
      if (extracted["Active leak"]) set("active_leak", "yes");
      if (extracted["Insurance"]) set("insurance_started", extracted["Insurance"].includes("Not") ? "no" : "yes");
      setAiFilled(filled);
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(extracted)]);

  // When the call completes and creates the lead, jump to the saved record.
  useEffect(() => {
    if (live?.phase === "done" && live.result?.leadId) {
      router.push(`/app/leads/${live.result.leadId}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live?.phase]);

  function update(key: keyof Fields, value: string) {
    touched.current.add(key);
    setFields((p) => ({ ...p, [key]: value }) as Fields);
  }

  const missingRequired = useMemo(() => {
    const req: (keyof Fields)[] = ["first_name", "phone", "service_type"];
    return req.filter((k) => !fields[k]);
  }, [fields]);

  function save() {
    if (!fields.first_name || !fields.service_type) {
      toast.error("At least a name and service are required");
      return;
    }
    setSaving(true);
    void createLead({
      first_name: fields.first_name,
      last_name: fields.last_name,
      phone: fields.phone || null,
      email: fields.email || null,
      street_address: fields.street_address || null,
      city: fields.city || null,
      state: fields.state || null,
      zip_code: fields.zip_code || null,
      service_type: fields.service_type as LeadInput["service_type"],
      description: fields.description,
      active_leak: fields.active_leak || null,
      insurance_started: fields.insurance_started || null,
      source: "manual",
    }).then((res) => {
      setSaving(false);
      if (res.success) {
        toast.success("Lead created");
        router.push(`/app/leads/${res.data.leadId}`);
      } else {
        toast.error(res.error);
      }
    });
  }

  function fieldCls(key: keyof Fields) {
    return cn(
      "transition-colors",
      aiFilled.has(key) && "border-status-success bg-green-50/60",
      callActive && missingRequired.includes(key) && "border-red-400 bg-red-50"
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2 text-base">
          New lead
          {callActive ? (
            <Badge variant="secondary" className="gap-1">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
              </span>
              <Bot className="h-3 w-3" />
              AI filling this live from the call
            </Badge>
          ) : null}
        </CardTitle>
        <CardDescription>
          {callActive
            ? "Watch the fields fill as the AI talks. Anything red is still needed — ask for it. You can also type over anything."
            : "Enter a lead by hand (walk-in, phone note, or if the AI is offline). It saves to the CRM and gets AI-analyzed like any other lead."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="First name" required filled={aiFilled.has("first_name")}>
            <Input value={fields.first_name} onChange={(e) => update("first_name", e.target.value)} className={fieldCls("first_name")} />
          </Field>
          <Field label="Last name" filled={aiFilled.has("last_name")}>
            <Input value={fields.last_name} onChange={(e) => update("last_name", e.target.value)} className={fieldCls("last_name")} />
          </Field>
          <Field label="Phone" required filled={aiFilled.has("phone")}>
            <Input value={fields.phone} onChange={(e) => update("phone", e.target.value)} className={fieldCls("phone")} />
          </Field>
          <Field label="Email" filled={aiFilled.has("email")}>
            <Input value={fields.email} onChange={(e) => update("email", e.target.value)} className={fieldCls("email")} />
          </Field>
          <Field label="Street address" filled={aiFilled.has("street_address")}>
            <Input value={fields.street_address} onChange={(e) => update("street_address", e.target.value)} className={fieldCls("street_address")} />
          </Field>
          <div className="grid grid-cols-3 gap-2">
            <Field label="City" filled={aiFilled.has("city")}>
              <Input value={fields.city} onChange={(e) => update("city", e.target.value)} className={fieldCls("city")} />
            </Field>
            <Field label="State" filled={aiFilled.has("state")}>
              <Input value={fields.state} onChange={(e) => update("state", e.target.value)} className={fieldCls("state")} />
            </Field>
            <Field label="ZIP" filled={aiFilled.has("zip_code")}>
              <Input value={fields.zip_code} onChange={(e) => update("zip_code", e.target.value)} className={fieldCls("zip_code")} />
            </Field>
          </div>
          <Field label="Service" required filled={aiFilled.has("service_type")}>
            <Select value={fields.service_type} onValueChange={(v) => update("service_type", v)}>
              <SelectTrigger className={fieldCls("service_type")}>
                <SelectValue placeholder="Select…" />
              </SelectTrigger>
              <SelectContent>
                {SERVICES.map(([v, l]) => (
                  <SelectItem key={v} value={v}>
                    {l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Active leak?" filled={aiFilled.has("active_leak")}>
            <Select value={fields.active_leak} onValueChange={(v) => update("active_leak", v)}>
              <SelectTrigger className={fieldCls("active_leak")}>
                <SelectValue placeholder="—" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="yes">Yes</SelectItem>
                <SelectItem value="no">No</SelectItem>
                <SelectItem value="not_sure">Not sure</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </div>

        <Field label="Notes / what's going on" filled={aiFilled.has("description")}>
          <Textarea
            rows={3}
            value={fields.description}
            onChange={(e) => update("description", e.target.value)}
            className={fieldCls("description")}
          />
        </Field>

        {callActive ? (
          <div className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm">
            <PhoneCall className="h-4 w-4 text-primary" />
            Call in progress — the record saves automatically when it ends.
          </div>
        ) : (
          <Button onClick={save} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save lead
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function Field({
  label,
  required,
  filled,
  children,
}: {
  label: string;
  required?: boolean;
  filled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="flex items-center gap-1 text-xs">
        {label}
        {required && <span className="text-red-500">*</span>}
        {filled && (
          <span className="ml-1 inline-flex items-center gap-0.5 text-[10px] font-medium text-status-success">
            <Check className="h-3 w-3" /> AI
          </span>
        )}
      </Label>
      {children}
    </div>
  );
}
