"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Calculator,
  CloudLightning,
  Copy,
  Home,
  Loader2,
  RefreshCw,
  Sparkles,
} from "lucide-react";
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { generatePropertyProfile, generateQuoteEstimate, type QuoteRequest } from "@/lib/actions/quotes";
import type { calculateQuote } from "@/lib/property/quoteCalculator";
import type { PropertyResearch, QuoteEstimate } from "@/types/app";

interface LeadOption {
  id: string;
  first_name: string;
  last_name: string;
  service_type: string;
  stage: string;
  city: string | null;
  urgency: string;
}

type QuoteOutput = {
  result: ReturnType<typeof calculateQuote>;
  ai_summary: string | null;
  talking_points: string[];
};

export function QuoteToolClient({
  leads,
  selectedLead,
  property,
  previousQuote,
}: {
  leads: LeadOption[];
  selectedLead: LeadOption | null;
  property: PropertyResearch | null;
  previousQuote: QuoteEstimate | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [propertyPending, startPropertyTransition] = useTransition();
  const [output, setOutput] = useState<QuoteOutput | null>(null);

  // Job inputs
  const [serviceType, setServiceType] = useState(selectedLead?.service_type ?? "roofing");
  const [materialTier, setMaterialTier] = useState<"good" | "better" | "best">("better");
  const [complexity, setComplexity] = useState<"simple" | "moderate" | "complex">("moderate");
  const [windowCount, setWindowCount] = useState<string>("");
  const [gutterFeet, setGutterFeet] = useState<string>("");
  const [manualSqft, setManualSqft] = useState<string>("");
  const [manualStories, setManualStories] = useState<string>("");
  const [bathType, setBathType] = useState<"tub_to_shower" | "shower_update" | "full_remodel" | "accessibility">("tub_to_shower");
  const [activeLeak, setActiveLeak] = useState(false);
  const [notes, setNotes] = useState("");

  // Weather context
  const [hail, setHail] = useState(false);
  const [wind, setWind] = useState(false);
  const [rain, setRain] = useState(false);
  const [stormDate, setStormDate] = useState("");
  const [severity, setSeverity] = useState<"none" | "minor" | "moderate" | "severe">("none");
  const [stormVolume, setStormVolume] = useState<"low" | "medium" | "high">("low");

  useEffect(() => {
    if (selectedLead) {
      setServiceType(selectedLead.service_type === "not_sure" ? "roofing" : selectedLead.service_type);
      setOutput(null);
    }
  }, [selectedLead?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  function loadProperty() {
    if (!selectedLead) return;
    startPropertyTransition(async () => {
      const result = await generatePropertyProfile(selectedLead.id);
      if (result.success) {
        toast.success("Demo property profile generated");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  function generate() {
    if (!selectedLead) {
      toast.error("Select a lead first");
      return;
    }
    const request: QuoteRequest = {
      lead_id: selectedLead.id,
      service_type: serviceType,
      material_tier: materialTier,
      complexity,
      finished_sqft: manualSqft ? Number(manualSqft) : (property?.finished_sqft ?? undefined),
      stories: manualStories ? Number(manualStories) : (property?.stories ?? undefined),
      roof_pitch: (property?.roof_pitch as "low" | "moderate" | "steep" | null) ?? undefined,
      estimated_roof_sqft: property?.estimated_roof_sqft ?? undefined,
      estimated_siding_sqft: property?.estimated_siding_sqft ?? undefined,
      window_count: windowCount ? Number(windowCount) : property?.estimated_window_count ?? undefined,
      gutter_linear_feet: gutterFeet ? Number(gutterFeet) : undefined,
      active_leak: activeLeak,
      bath_type: serviceType === "bath" ? bathType : undefined,
      weather: {
        recent_hail: hail,
        recent_high_wind: wind,
        heavy_rain: rain,
        storm_date: stormDate || null,
        reported_severity: severity,
        neighborhood_storm_volume: stormVolume,
      },
      internal_notes: notes || undefined,
    };
    startTransition(async () => {
      const result = await generateQuoteEstimate(request);
      if (result.success) {
        setOutput(result.data);
        toast.success("Internal ballpark saved to the lead");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  function copyQuote() {
    if (!output) return;
    const text = [
      `Internal Ballpark: $${output.result.estimate_low.toLocaleString()}–$${output.result.estimate_high.toLocaleString()}`,
      `Confidence: ${output.result.confidence}`,
      "",
      "Assumptions:",
      ...output.result.assumptions.map((a) => `- ${a}`),
      "",
      "Next inspection questions:",
      ...output.result.inspection_questions.map((q) => `- ${q}`),
    ].join("\n");
    void navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  }

  return (
    <div className="grid gap-6 xl:grid-cols-3">
      <div className="space-y-6">
        {/* Lead selection */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Lead</CardTitle>
          </CardHeader>
          <CardContent>
            <Select
              value={selectedLead?.id ?? ""}
              onValueChange={(value) => router.push(`/app/quote-tool?lead=${value}`)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a lead…" />
              </SelectTrigger>
              <SelectContent>
                {leads.map((lead) => (
                  <SelectItem key={lead.id} value={lead.id}>
                    {lead.first_name} {lead.last_name} — {lead.service_type.replace(/_/g, " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {previousQuote && (
              <p className="mt-3 text-xs text-muted-foreground">
                Last estimate: ${Number(previousQuote.estimate_low).toLocaleString()}–$
                {Number(previousQuote.estimate_high).toLocaleString()} ({previousQuote.confidence}{" "}
                confidence)
              </p>
            )}
          </CardContent>
        </Card>

        {/* Property research */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Home className="h-4 w-4 text-primary" />
              Property research
              {property && (
                <Badge className="bg-amber-100 text-amber-800 text-[10px]" variant="secondary">
                  Simulated data
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              These values are simulated for the demo — not pulled from the web. In production,
              this panel would be fed by county assessor records (public) or a paid property-data
              API (e.g. ATTOM, Estated); Zillow does not offer a public API. You can also override
              the key numbers manually in the job inputs.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {property ? (
              <dl className="space-y-1 text-sm">
                {[
                  ["Address", property.address],
                  ["Year built", property.year_built],
                  ["Finished sqft", property.finished_sqft?.toLocaleString()],
                  ["Stories", property.stories],
                  ["Roof type", property.roof_type],
                  ["Roof pitch", property.roof_pitch],
                  ["Est. roof sqft", property.estimated_roof_sqft?.toLocaleString()],
                  ["Siding", property.siding_material],
                  ["Est. siding sqft", property.estimated_siding_sqft?.toLocaleString()],
                  ["Est. windows", property.estimated_window_count],
                  ["Confidence", property.confidence],
                ].map(([label, value]) => (
                  <div key={String(label)} className="flex justify-between gap-3 border-b py-1 last:border-0">
                    <dt className="text-muted-foreground">{label}</dt>
                    <dd className="text-right font-medium capitalize">{value ?? "—"}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="text-sm text-muted-foreground">
                No property data for this lead yet.
              </p>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={loadProperty}
              disabled={propertyPending || !selectedLead}
            >
              {propertyPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              {property ? "Refresh demo profile" : "Generate demo property profile"}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Inputs */}
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Calculator className="h-4 w-4 text-primary" />
              Job inputs
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Service</Label>
                <Select value={serviceType} onValueChange={setServiceType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["roofing", "storm_damage", "siding", "windows", "doors", "gutters", "leaf_protection", "bath"].map((s) => (
                      <SelectItem key={s} value={s} className="capitalize">
                        {s.replace(/_/g, " ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Material tier</Label>
                <Select value={materialTier} onValueChange={(v) => setMaterialTier(v as typeof materialTier)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="good">Good</SelectItem>
                    <SelectItem value="better">Better</SelectItem>
                    <SelectItem value="best">Best</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Finished sqft (override)</Label>
                <Input
                  type="number"
                  placeholder={String(property?.finished_sqft ?? "e.g. 2100")}
                  value={manualSqft}
                  onChange={(e) => setManualSqft(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Stories (override)</Label>
                <Input
                  type="number"
                  step="0.5"
                  placeholder={String(property?.stories ?? "e.g. 1.5")}
                  value={manualStories}
                  onChange={(e) => setManualStories(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Complexity / access</Label>
                <Select value={complexity} onValueChange={(v) => setComplexity(v as typeof complexity)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="simple">Simple</SelectItem>
                    <SelectItem value="moderate">Moderate</SelectItem>
                    <SelectItem value="complex">Complex</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {(serviceType === "windows") && (
                <div className="space-y-1.5">
                  <Label>Window count</Label>
                  <Input
                    type="number"
                    placeholder={String(property?.estimated_window_count ?? 10)}
                    value={windowCount}
                    onChange={(e) => setWindowCount(e.target.value)}
                  />
                </div>
              )}
              {(serviceType === "gutters" || serviceType === "leaf_protection") && (
                <div className="space-y-1.5">
                  <Label>Gutter linear feet</Label>
                  <Input
                    type="number"
                    placeholder="160"
                    value={gutterFeet}
                    onChange={(e) => setGutterFeet(e.target.value)}
                  />
                </div>
              )}
              {serviceType === "bath" && (
                <div className="space-y-1.5">
                  <Label>Bath project</Label>
                  <Select value={bathType} onValueChange={(v) => setBathType(v as typeof bathType)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="tub_to_shower">Tub to shower</SelectItem>
                      <SelectItem value="shower_update">Shower update</SelectItem>
                      <SelectItem value="full_remodel">Full remodel</SelectItem>
                      <SelectItem value="accessibility">Accessibility</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <Label htmlFor="active-leak" className="text-sm">
                Active leak reported
              </Label>
              <Switch id="active-leak" checked={activeLeak} onCheckedChange={setActiveLeak} />
            </div>
            <Textarea
              placeholder="Internal notes (optional)…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CloudLightning className="h-4 w-4 text-status-warning" />
              Weather / storm context
            </CardTitle>
            <CardDescription>
              Affects urgency, inspection priority, and insurance talking points — not the final price.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              ["Recent hail", hail, setHail],
              ["Recent high wind", wind, setWind],
              ["Heavy rain", rain, setRain],
            ].map(([label, value, setter]) => (
              <div key={String(label)} className="flex items-center justify-between rounded-lg border p-2.5">
                <Label className="text-sm">{String(label)}</Label>
                <Switch
                  checked={Boolean(value)}
                  onCheckedChange={setter as (checked: boolean) => void}
                />
              </div>
            ))}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Storm date</Label>
                <Input type="date" value={stormDate} onChange={(e) => setStormDate(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Reported severity</Label>
                <Select value={severity} onValueChange={(v) => setSeverity(v as typeof severity)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["none", "minor", "moderate", "severe"].map((s) => (
                      <SelectItem key={s} value={s} className="capitalize">
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Neighborhood storm volume</Label>
                <Select value={stormVolume} onValueChange={(v) => setStormVolume(v as typeof stormVolume)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["low", "medium", "high"].map((s) => (
                      <SelectItem key={s} value={s} className="capitalize">
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        <Button className="w-full" onClick={generate} disabled={pending || !selectedLead}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          Generate internal ballpark
        </Button>
      </div>

      {/* Output */}
      <div>
        {output ? (
          <Card className="border-primary/30">
            <CardHeader>
              <CardTitle className="text-base">Internal ballpark</CardTitle>
              <CardDescription>
                Internal ballpark — not a final quote. Requires inspection before any customer
                pricing.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 text-center">
                <p className="text-2xl font-semibold tracking-tight">
                  ${output.result.estimate_low.toLocaleString()} – $
                  {output.result.estimate_high.toLocaleString()}
                </p>
                <Badge variant="secondary" className="mt-1.5 capitalize">
                  {output.result.confidence} confidence
                </Badge>
              </div>

              {output.ai_summary && <p className="text-sm">{output.ai_summary}</p>}

              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Line items</p>
                <ul className="mt-1.5 space-y-1.5">
                  {output.result.line_items.map((item) => (
                    <li key={item.label} className="rounded-md border p-2 text-sm">
                      <div className="flex justify-between gap-2 font-medium">
                        <span>{item.label}</span>
                        <span className="tabular-nums">
                          ${item.low.toLocaleString()}–${item.high.toLocaleString()}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">{item.detail}</p>
                    </li>
                  ))}
                </ul>
              </div>

              <ListBlock title="Assumptions" items={output.result.assumptions} />
              <ListBlock title="Missing info" items={output.result.missing_info} />
              <ListBlock title="Next inspection questions" items={output.result.inspection_questions} />
              <ListBlock title="Sales talking points" items={output.talking_points} />

              {output.result.weather_note && (
                <div className="rounded-lg border border-status-warning/40 bg-amber-50 p-3 text-sm">
                  {output.result.weather_note}
                </div>
              )}

              <Button variant="outline" size="sm" onClick={copyQuote}>
                <Copy className="h-3.5 w-3.5" />
                Copy estimate
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="py-16 text-center text-sm text-muted-foreground">
              {selectedLead
                ? "Set the inputs and generate an internal ballpark. It saves to the lead's timeline."
                : "Select a lead to start."}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function ListBlock({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
      <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-muted-foreground">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
