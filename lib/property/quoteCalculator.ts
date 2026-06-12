import type { QuoteLineItem } from "@/types/app";
import type { WeatherContext } from "./types";

/**
 * Deterministic internal ballpark calculators. These are demo pricing models —
 * clearly labeled in the UI as "internal ballpark, requires inspection before
 * final quote." Pricing ranges are simple and editable here in one place.
 */

export interface QuoteInputs {
  service_type: string;
  // property
  finished_sqft?: number;
  stories?: number;
  roof_pitch?: "low" | "moderate" | "steep";
  roof_age_years?: number;
  estimated_roof_sqft?: number;
  estimated_siding_sqft?: number;
  window_count?: number;
  gutter_linear_feet?: number;
  // job
  material_tier: "good" | "better" | "best";
  complexity: "simple" | "moderate" | "complex";
  tearoff_needed?: boolean;
  active_leak?: boolean;
  leaf_protection?: boolean;
  bath_type?: "tub_to_shower" | "shower_update" | "full_remodel" | "accessibility";
}

export interface QuoteResult {
  estimate_low: number;
  estimate_high: number;
  confidence: "low" | "medium" | "high";
  line_items: QuoteLineItem[];
  assumptions: string[];
  missing_info: string[];
  inspection_questions: string[];
  weather_note: string | null;
}

const TIER_FACTOR = { good: 1, better: 1.22, best: 1.5 };
const COMPLEXITY_FACTOR = { simple: 1, moderate: 1.12, complex: 1.3 };
const PITCH_FACTOR = { low: 1.08, moderate: 1.2, steep: 1.35 };

function round100(n: number) {
  return Math.round(n / 100) * 100;
}

export function calculateQuote(inputs: QuoteInputs, weather: WeatherContext): QuoteResult {
  const assumptions: string[] = [];
  const missing: string[] = [];
  const lineItems: QuoteLineItem[] = [];
  const questions: string[] = [
    "Is water actively entering the home?",
    "Has insurance been contacted?",
  ];
  let low = 0;
  let high = 0;
  let confidence: QuoteResult["confidence"] = "medium";

  const tier = TIER_FACTOR[inputs.material_tier];
  const complexity = COMPLEXITY_FACTOR[inputs.complexity];

  switch (inputs.service_type) {
    case "roofing":
    case "storm_damage": {
      const stories = inputs.stories ?? 1.5;
      const pitch = inputs.roof_pitch ?? "moderate";
      let roofSqft = inputs.estimated_roof_sqft;
      if (!roofSqft) {
        if (inputs.finished_sqft) {
          roofSqft = Math.round((inputs.finished_sqft / stories) * PITCH_FACTOR[pitch] * 1.1);
          assumptions.push(
            `Roof area estimated from ${inputs.finished_sqft} finished sqft over ${stories} stories with ${pitch} pitch`
          );
        } else {
          roofSqft = 2200;
          missing.push("Home square footage or measured roof area");
          confidence = "low";
          assumptions.push("Roof area defaulted to 22 squares — no property data provided");
        }
      }
      const wasteAdjusted = roofSqft * 1.1;
      const squares = Math.ceil(wasteAdjusted / 100);
      assumptions.push(`~${squares} roofing squares including 10% waste factor`);
      const lowPerSquare = 450 * tier * complexity;
      const highPerSquare = 700 * tier * complexity;
      lineItems.push({
        label: "Roofing system",
        detail: `${squares} squares · ${inputs.material_tier} tier · ${inputs.complexity} complexity`,
        low: round100(squares * lowPerSquare),
        high: round100(squares * highPerSquare),
      });
      if (inputs.tearoff_needed !== false) {
        lineItems.push({
          label: "Tear-off and disposal",
          detail: "Single-layer tear-off assumed",
          low: round100(squares * 90),
          high: round100(squares * 140),
        });
        assumptions.push("Single-layer tear-off assumed — additional layers add cost");
      }
      if (inputs.active_leak) {
        lineItems.push({
          label: "Interior assessment allowance",
          detail: "Active leak reported — decking and interior check required",
          low: 400,
          high: 1500,
        });
        assumptions.push("Active leak increases urgency; final scope requires inspection of decking");
      }
      questions.push("When was the roof last replaced?", "Is the decking damaged or soft anywhere?");
      if (!inputs.roof_age_years) missing.push("Roof age");
      break;
    }
    case "siding": {
      let sidingSqft = inputs.estimated_siding_sqft;
      if (!sidingSqft) {
        if (inputs.finished_sqft) {
          const stories = inputs.stories ?? 1.5;
          const footprint = inputs.finished_sqft / stories;
          sidingSqft = Math.round(4 * Math.sqrt(footprint) * 1.15 * (stories >= 2 ? 19 : 12) * 0.82);
          assumptions.push("Siding area estimated from footprint, perimeter, and wall height minus openings");
        } else {
          sidingSqft = 1800;
          missing.push("Home square footage or measured wall area");
          confidence = "low";
        }
      }
      lineItems.push({
        label: "Siding replacement",
        detail: `~${sidingSqft} sqft · ${inputs.material_tier} tier`,
        low: round100(sidingSqft * 7 * tier * complexity),
        high: round100(sidingSqft * 12 * tier * complexity),
      });
      questions.push("Any soft spots, rot, or water staining behind the current siding?");
      break;
    }
    case "windows": {
      const count = inputs.window_count ?? 10;
      if (!inputs.window_count) {
        missing.push("Exact window count");
        assumptions.push("Defaulted to 10 windows");
      }
      lineItems.push({
        label: "Window replacement",
        detail: `${count} windows · ${inputs.material_tier} tier · installed`,
        low: round100(count * 650 * tier * complexity),
        high: round100(count * 1100 * tier * complexity),
      });
      questions.push("Any rot at the sills or frames?", "Egress or specialty shapes involved?");
      break;
    }
    case "doors": {
      lineItems.push({
        label: "Entry/patio door replacement",
        detail: `${inputs.material_tier} tier, installed`,
        low: round100(2200 * tier * complexity),
        high: round100(6500 * tier * complexity),
      });
      questions.push("Standard size opening, or will framing changes be needed?");
      break;
    }
    case "gutters":
    case "leaf_protection": {
      const feet = inputs.gutter_linear_feet ?? 160;
      if (!inputs.gutter_linear_feet) {
        missing.push("Measured gutter linear feet");
        assumptions.push("Defaulted to 160 linear feet");
      }
      lineItems.push({
        label: "Seamless gutters & downspouts",
        detail: `~${feet} linear feet`,
        low: round100(feet * 9 * complexity),
        high: round100(feet * 15 * complexity),
      });
      if (inputs.leaf_protection || inputs.service_type === "leaf_protection") {
        lineItems.push({
          label: "Leaf protection system",
          detail: `~${feet} linear feet · ${inputs.material_tier} tier`,
          low: round100(feet * 12 * tier),
          high: round100(feet * 22 * tier),
        });
      }
      questions.push("How many stories, and is there roof access all the way around?");
      break;
    }
    case "bath": {
      const bathType = inputs.bath_type ?? "tub_to_shower";
      const base: Record<string, [number, number, string]> = {
        tub_to_shower: [9000, 16000, "Tub-to-shower conversion"],
        shower_update: [7000, 13000, "Shower replacement/update"],
        full_remodel: [24000, 45000, "Full bath remodel"],
        accessibility: [11000, 19000, "Accessibility conversion (low step, grab bars)"],
      };
      const [bLow, bHigh, label] = base[bathType];
      lineItems.push({
        label,
        detail: `${inputs.material_tier} tier · ${inputs.complexity} plumbing complexity`,
        low: round100(bLow * tier * complexity),
        high: round100(bHigh * tier * complexity),
      });
      questions.push("Any known plumbing issues or subfloor damage?");
      break;
    }
    default: {
      lineItems.push({
        label: "General exterior project allowance",
        detail: "Service type not yet specified",
        low: 3000,
        high: 12000,
      });
      missing.push("Confirmed service type");
      confidence = "low";
    }
  }

  low = lineItems.reduce((s, li) => s + li.low, 0);
  high = lineItems.reduce((s, li) => s + li.high, 0);

  // Weather context affects urgency and inspection priority — and demand-driven
  // complexity when the neighborhood is saturated with storm work.
  let weatherNote: string | null = null;
  const stormy = weather.recent_hail || weather.recent_high_wind || weather.heavy_rain;
  if (stormy) {
    const parts = [
      weather.recent_hail ? "hail" : null,
      weather.recent_high_wind ? "high wind" : null,
      weather.heavy_rain ? "heavy rain" : null,
    ].filter(Boolean);
    weatherNote = `Recent ${parts.join(" + ")} reported${
      weather.storm_date ? ` (~${weather.storm_date})` : ""
    } with ${weather.reported_severity} customer-reported severity. Prioritize inspection; document damage with photos for a possible insurance conversation. Do not promise coverage.`;
    if (weather.neighborhood_storm_volume === "high") {
      high = round100(high * 1.08);
      assumptions.push("High neighborhood storm volume — crew demand may extend timeline and tighten pricing flexibility");
    }
    questions.unshift("What date did the storm come through, and what damage is visible from the ground?");
  }

  if (missing.length >= 2) confidence = "low";
  if (missing.length === 0 && inputs.finished_sqft) {
    confidence = confidence === "low" ? "medium" : confidence;
  }

  return {
    estimate_low: round100(low),
    estimate_high: round100(high),
    confidence,
    line_items: lineItems,
    assumptions,
    missing_info: missing,
    inspection_questions: questions,
    weather_note: weatherNote,
  };
}
