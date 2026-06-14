"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
import { submitLead } from "@/lib/actions";
import { leadFormSchema, type LeadFormValues } from "@/lib/validations/lead";

const SERVICE_OPTIONS = [
  ["roofing", "Roofing"],
  ["siding", "Siding"],
  ["windows", "Windows"],
  ["doors", "Doors"],
  ["bath", "Bath"],
  ["gutters", "Gutters"],
  ["leaf_protection", "Leaf Protection"],
  ["storm_damage", "Storm Damage"],
  ["not_sure", "Not Sure"],
] as const;

const REASON_OPTIONS = [
  ["damage_repair", "Damage / repair"],
  ["replacement", "Replacement"],
  ["upgrade", "Upgrade"],
  ["leak_urgent", "Leak / urgent issue"],
  ["insurance_claim", "Insurance claim"],
  ["maintenance", "Maintenance"],
  ["other", "Other"],
] as const;

const TIMEFRAME_OPTIONS = [
  ["emergency", "Emergency"],
  ["this_week", "This week"],
  ["this_month", "This month"],
  ["1_3_months", "1–3 months"],
  ["researching", "Just researching"],
] as const;

const BUDGET_OPTIONS = [
  ["under_5k", "Under $5,000"],
  ["5k_15k", "$5,000–$15,000"],
  ["15k_30k", "$15,000–$30,000"],
  ["30k_plus", "$30,000+"],
  ["not_sure", "Not sure"],
] as const;

const SOURCE_OPTIONS = [
  ["google", "Google"],
  ["facebook", "Facebook"],
  ["referral", "Referral"],
  ["yard_sign", "Yard sign"],
  ["previous_customer", "Previous customer"],
  ["event", "Event"],
  ["other", "Other"],
] as const;

function SelectField({
  label,
  error,
  value,
  onChange,
  options,
  placeholder = "Select…",
}: {
  label: string;
  error?: string;
  value: string | undefined;
  onChange: (value: string) => void;
  options: ReadonlyArray<readonly [string, string]>;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map(([optionValue, optionLabel]) => (
            <SelectItem key={optionValue} value={optionValue}>
              {optionLabel}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

function TextField({
  label,
  error,
  ...inputProps
}: { label: string; error?: string } & React.ComponentProps<typeof Input>) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={inputProps.id}>{label}</Label>
      <Input {...inputProps} />
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

const DEMO_CUSTOMERS: LeadFormValues[] = [
  {
    first_name: "Sarah",
    last_name: "Mitchell",
    email: "sarah.mitchell@example.com",
    phone: "(414) 555-0188",
    preferred_contact_method: "phone",
    best_time_to_contact: "afternoon",
    street_address: "123 Demo Lane",
    city: "Sussex",
    state: "WI",
    zip_code: "53089",
    homeowner_status: "owner",
    service_type: "storm_damage",
    project_reason: "damage_repair",
    timeframe: "emergency",
    budget_range: "not_sure",
    description:
      "We had hail last week and now I'm seeing missing shingles and a water spot on the ceiling upstairs. It looks like it's getting bigger.",
    insurance_started: "no",
    active_leak: "yes",
    source: "google",
  },
  {
    first_name: "Emily",
    last_name: "Hart",
    email: "emily.hart@example.com",
    phone: "(262) 555-0171",
    preferred_contact_method: "text",
    best_time_to_contact: "evening",
    street_address: "2240 Sunset Ridge Dr",
    city: "Brookfield",
    state: "WI",
    zip_code: "53045",
    homeowner_status: "owner",
    service_type: "windows",
    project_reason: "replacement",
    timeframe: "1_3_months",
    budget_range: "15k_30k",
    description:
      "Our house was built in 1992 and the original windows are drafty and fog up between the panes. We'd like to replace the first floor before winter.",
    insurance_started: "not_applicable",
    active_leak: "no",
    source: "referral",
  },
  {
    first_name: "Dale",
    last_name: "Kowalski",
    email: "dale.kowalski@example.com",
    phone: "(414) 555-0136",
    preferred_contact_method: "phone",
    best_time_to_contact: "morning",
    street_address: "815 Foxglove Ct",
    city: "Menomonee Falls",
    state: "WI",
    zip_code: "53051",
    homeowner_status: "owner",
    service_type: "gutters",
    project_reason: "damage_repair",
    timeframe: "this_week",
    budget_range: "under_5k",
    description:
      "Gutters are pulling away from the fascia in the back and overflowing every time it rains hard.",
    insurance_started: "not_sure",
    active_leak: "no",
    source: "yard_sign",
  },
];

/** Fired by the demo guide widget to auto-fill the form from anywhere on the page. */
export const DEMO_FILL_EVENT = "northstar-demo-fill";

export function LeadForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<LeadFormValues>({
    resolver: zodResolver(leadFormSchema),
    defaultValues: {
      preferred_contact_method: "phone",
      best_time_to_contact: "anytime",
      homeowner_status: "owner",
      state: "MN",
    },
  });

  // Auto-fill triggers: the demo guide dispatches an event when already on
  // this page, or links here with ?fill=demo from elsewhere.
  useEffect(() => {
    const fill = () => {
      reset(DEMO_CUSTOMERS[Math.floor(Math.random() * DEMO_CUSTOMERS.length)]);
      toast.success("Form filled with a demo customer — review and submit");
    };
    if (searchParams.get("fill") === "demo") fill();
    window.addEventListener(DEMO_FILL_EVENT, fill);
    return () => window.removeEventListener(DEMO_FILL_EVENT, fill);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onSubmit(values: LeadFormValues) {
    setSubmitting(true);
    const result = await submitLead(values);
    if (result.success) {
      // Carry the dashboard-demo flag so the success page hands the call back
      // to the dashboard tab instead of running the call in this tab.
      const demo = searchParams.get("demo") === "dashboard" ? "&demo=dashboard" : "";
      router.push(
        `/request/success?name=${encodeURIComponent(values.first_name)}&service=${values.service_type}&timeframe=${values.timeframe}&lead=${result.data?.leadId ?? ""}&phone=${encodeURIComponent(values.phone)}${demo}`
      );
    } else {
      toast.error(result.error);
      setSubmitting(false);
    }
  }

  const fromDashboardTour = searchParams.get("demo") === "dashboard";

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {fromDashboardTour && (
        <div className="rounded-lg border-2 border-brand-gold bg-brand-gold/15 p-4">
          <p className="text-sm font-bold uppercase tracking-wide text-brand-dark">
            You are the customer in this scenario
          </p>
          <p className="mt-1 text-sm text-brand-dark/80">
            Fill this out (or hit “Generate demo customer”) and submit it. Then this tab closes and
            you answer the call popup back on the dashboard — go through the AI scheduling
            assistant like a normal customer would and book your inspection.
          </p>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-brand-gold/40 bg-brand-gold/10 p-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="bg-background"
          onClick={() =>
            reset(DEMO_CUSTOMERS[Math.floor(Math.random() * DEMO_CUSTOMERS.length)])
          }
        >
          <Sparkles className="h-3.5 w-3.5 text-brand-gold" />
          Generate demo customer
        </Button>
        <p className="text-xs text-muted-foreground">
          Auto-fills the form with a realistic homeowner — or enter your own info; everything you
          type works in the demo. After submitting, watch for the AI callback.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Contact information</CardTitle>
          <CardDescription>How should we reach you?</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <TextField label="First name" id="first_name" error={errors.first_name?.message} {...register("first_name")} />
          <TextField label="Last name" id="last_name" error={errors.last_name?.message} {...register("last_name")} />
          <TextField label="Email" id="email" type="email" error={errors.email?.message} {...register("email")} />
          <TextField label="Phone" id="phone" type="tel" error={errors.phone?.message} {...register("phone")} />
          <Controller
            control={control}
            name="preferred_contact_method"
            render={({ field }) => (
              <SelectField
                label="Preferred contact method"
                value={field.value}
                onChange={field.onChange}
                error={errors.preferred_contact_method?.message}
                options={[["phone", "Phone"], ["text", "Text"], ["email", "Email"]]}
              />
            )}
          />
          <Controller
            control={control}
            name="best_time_to_contact"
            render={({ field }) => (
              <SelectField
                label="Best time to contact"
                value={field.value}
                onChange={field.onChange}
                error={errors.best_time_to_contact?.message}
                options={[
                  ["morning", "Morning"],
                  ["afternoon", "Afternoon"],
                  ["evening", "Evening"],
                  ["anytime", "Anytime"],
                ]}
              />
            )}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Property information</CardTitle>
          <CardDescription>Where is the work needed?</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <TextField label="Street address" id="street_address" error={errors.street_address?.message} {...register("street_address")} />
          </div>
          <TextField label="City" id="city" error={errors.city?.message} {...register("city")} />
          <div className="grid grid-cols-2 gap-4">
            <TextField label="State" id="state" error={errors.state?.message} {...register("state")} />
            <TextField label="ZIP code" id="zip_code" error={errors.zip_code?.message} {...register("zip_code")} />
          </div>
          <Controller
            control={control}
            name="homeowner_status"
            render={({ field }) => (
              <SelectField
                label="Homeowner status"
                value={field.value}
                onChange={field.onChange}
                error={errors.homeowner_status?.message}
                options={[
                  ["owner", "Owner"],
                  ["buyer_under_contract", "Buyer under contract"],
                  ["property_manager", "Property manager"],
                  ["other", "Other"],
                ]}
              />
            )}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Service need</CardTitle>
          <CardDescription>What kind of project is this?</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Controller
            control={control}
            name="service_type"
            render={({ field }) => (
              <SelectField
                label="Service type"
                value={field.value}
                onChange={field.onChange}
                error={errors.service_type?.message}
                options={SERVICE_OPTIONS}
              />
            )}
          />
          <Controller
            control={control}
            name="project_reason"
            render={({ field }) => (
              <SelectField
                label="Project reason"
                value={field.value}
                onChange={field.onChange}
                error={errors.project_reason?.message}
                options={REASON_OPTIONS}
              />
            )}
          />
          <Controller
            control={control}
            name="timeframe"
            render={({ field }) => (
              <SelectField
                label="Timeframe"
                value={field.value}
                onChange={field.onChange}
                error={errors.timeframe?.message}
                options={TIMEFRAME_OPTIONS}
              />
            )}
          />
          <Controller
            control={control}
            name="budget_range"
            render={({ field }) => (
              <SelectField
                label="Budget range"
                value={field.value}
                onChange={field.onChange}
                error={errors.budget_range?.message}
                options={BUDGET_OPTIONS}
              />
            )}
          />
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="description">Tell us what is going on</Label>
            <Textarea
              id="description"
              rows={5}
              placeholder="Example: We had hail last week and now I'm seeing missing shingles and water spots on the ceiling upstairs."
              {...register("description")}
            />
            {errors.description ? (
              <p className="text-xs text-destructive">{errors.description.message}</p>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>A few optional details</CardTitle>
          <CardDescription>These help us respond with the right next step.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <Controller
            control={control}
            name="insurance_started"
            render={({ field }) => (
              <SelectField
                label="Insurance claim started?"
                value={field.value}
                onChange={field.onChange}
                options={[
                  ["yes", "Yes"],
                  ["no", "No"],
                  ["not_sure", "Not sure"],
                  ["not_applicable", "Not applicable"],
                ]}
              />
            )}
          />
          <Controller
            control={control}
            name="active_leak"
            render={({ field }) => (
              <SelectField
                label="Active leaking?"
                value={field.value}
                onChange={field.onChange}
                options={[
                  ["yes", "Yes"],
                  ["no", "No"],
                  ["not_sure", "Not sure"],
                ]}
              />
            )}
          />
          <Controller
            control={control}
            name="source"
            render={({ field }) => (
              <SelectField
                label="How did you hear about us?"
                value={field.value}
                onChange={field.onChange}
                options={SOURCE_OPTIONS}
              />
            )}
          />
        </CardContent>
      </Card>

      <div className="flex flex-col items-start gap-3">
        <Button type="submit" size="lg" disabled={submitting}>
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Submitting…
            </>
          ) : (
            "Submit Request"
          )}
        </Button>
        <p className="text-xs text-muted-foreground">
          This is a demonstration app for a portfolio project. No real service
          request will be created and no one will contact you.
        </p>
      </div>
    </form>
  );
}
