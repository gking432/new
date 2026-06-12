export interface PropertyResearchResult {
  address: string;
  year_built: number;
  finished_sqft: number;
  stories: number;
  lot_size_sqft: number;
  roof_type: string;
  roof_pitch: "low" | "moderate" | "steep";
  siding_material: string;
  estimated_roof_sqft: number;
  estimated_siding_sqft: number;
  estimated_window_count: number;
  data_source: string;
  confidence: "low" | "medium" | "high";
  notes: string;
}

export interface PropertyProvider {
  lookupByAddress(address: string): Promise<PropertyResearchResult>;
}

export interface WeatherContext {
  recent_hail: boolean;
  recent_high_wind: boolean;
  heavy_rain: boolean;
  storm_date: string | null;
  reported_severity: "none" | "minor" | "moderate" | "severe";
  neighborhood_storm_volume: "low" | "medium" | "high";
}

export const DEFAULT_WEATHER: WeatherContext = {
  recent_hail: false,
  recent_high_wind: false,
  heavy_rain: false,
  storm_date: null,
  reported_severity: "none",
  neighborhood_storm_volume: "low",
};
