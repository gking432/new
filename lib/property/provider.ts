import { demoPropertyProvider } from "./demoProvider";
import type { PropertyProvider } from "./types";

/**
 * Property data provider registry. The demo provider is the only
 * implementation today; a live provider (county assessor API, property-data
 * vendor, or a web-research agent) plugs in behind the same interface.
 */
export function getPropertyProvider(): PropertyProvider {
  return demoPropertyProvider;
}
