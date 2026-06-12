import type { PropertyProvider, PropertyResearchResult } from "./types";

/**
 * Demo property data provider. Generates a plausible, deterministic property
 * profile from the address string (same address always returns the same
 * profile) — no paid APIs, no scraping. Swap in a real provider behind the
 * same interface later.
 */

function hashString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

const ROOF_TYPES = ["asphalt shingle", "asphalt shingle", "asphalt shingle", "architectural shingle", "cedar shake"];
const SIDING_MATERIALS = ["vinyl", "vinyl", "fiber cement", "cedar", "aluminum"];
const PITCHES: PropertyResearchResult["roof_pitch"][] = ["low", "moderate", "moderate", "steep"];

export const demoPropertyProvider: PropertyProvider = {
  async lookupByAddress(address: string): Promise<PropertyResearchResult> {
    const seed = hashString(address.toLowerCase().trim());
    const pick = (n: number, offset = 0) => (seed >> offset) % n;

    const yearBuilt = 1955 + pick(65, 2);
    const stories = [1, 1, 1.5, 2, 2][pick(5, 4)];
    const finishedSqft = 1100 + pick(2400, 6);
    const footprint = Math.round(finishedSqft / stories);
    const pitch = PITCHES[pick(PITCHES.length, 8)];
    const pitchFactor = pitch === "low" ? 1.08 : pitch === "moderate" ? 1.2 : 1.35;
    const roofSqft = Math.round(footprint * pitchFactor * 1.1);
    const perimeter = Math.round(4 * Math.sqrt(footprint) * 1.15);
    const wallHeight = stories >= 2 ? 19 : stories === 1.5 ? 14 : 9.5;
    const sidingSqft = Math.round(perimeter * wallHeight * 0.82); // minus openings

    return {
      address,
      year_built: yearBuilt,
      finished_sqft: finishedSqft,
      stories,
      lot_size_sqft: 7000 + pick(12000, 10),
      roof_type: ROOF_TYPES[pick(ROOF_TYPES.length, 12)],
      roof_pitch: pitch,
      siding_material: SIDING_MATERIALS[pick(SIDING_MATERIALS.length, 14)],
      estimated_roof_sqft: roofSqft,
      estimated_siding_sqft: sidingSqft,
      estimated_window_count: 10 + pick(16, 16),
      data_source: "demo",
      confidence: "medium",
      notes:
        "Demo property profile generated deterministically from the address. In production this would come from a county-assessor or property-data provider.",
    };
  },
};
