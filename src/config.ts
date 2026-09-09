/**
 * Central configuration for the districting POC.
 * Everything that a reviewer might want to tweak lives here.
 */

/**
 * Field on the source GeoJSON that uniquely identifies each polygon. When this
 * field is missing or non-numeric (e.g. string ids like "u0001"), the loader
 * falls back to the layer's auto-generated numeric objectIdField for internal
 * keying. Use LABEL_FIELD for a human-friendly identifier in popups.
 */
export const ID_FIELD = "OBJECTID";

/** Human-friendly identifier shown in popups (may be a string). */
export const LABEL_FIELD = "unit_id";

/**
 * Optional descriptive attributes carried from the source units layer.
 * Used only for popups. Missing fields are ignored gracefully.
 */
export const INFO_FIELDS: string[] = ["city", "county", "school_district"];

/**
 * Attribute holding a real population count. When present it is used directly;
 * otherwise population is fabricated from area (see POPULATION_MODEL).
 */
export const POPULATION_FIELD = "population";

/** Path to the client-side GeoJSON (WGS84 / EPSG:4326), served from public/. */
export const PARCELS_URL = "data/units.geojson";

/** Initial map extent (roughly the Portland, OR metro area). */
export const PORTLAND_EXTENT = {
  xmin: -122.9,
  ymin: 45.35,
  xmax: -122.4,
  ymax: 45.7,
  spatialReference: { wkid: 4326 }
};

/** Default lock thresholds. These are also editable live in the app UI. */
export const DEFAULT_THRESHOLDS = {
  /** Minimum aggregated population for a district to be lockable. */
  minPopulation: 40000,
  /** Minimum aggregated area (square miles) for a district to be lockable. */
  minAreaSqMi: 15
};

/**
 * Seeded population fabrication.
 * population = round(base + area_sq_mi * perSqMi * jitter)
 * jitter is deterministic per feature id so results are stable across reloads.
 */
export const POPULATION_MODEL = {
  base: 500,
  perSqMi: 3500,
  /** +/- fraction of random jitter applied deterministically. */
  jitter: 0.6
};

/** Symbol colors (RGBA). */
export const COLORS = {
  unassigned: [200, 200, 200, 0.35] as [number, number, number, number],
  unassignedOutline: [120, 120, 120, 0.8] as [number, number, number, number],
  working: [255, 213, 0, 0.55] as [number, number, number, number],
  workingOutline: [200, 150, 0, 1] as [number, number, number, number]
};

/** Distinct, high-contrast palette cycled for locked districts. */
export const DISTRICT_PALETTE: [number, number, number][] = [
  [31, 119, 180],
  [255, 127, 14],
  [44, 160, 44],
  [214, 39, 40],
  [148, 103, 189],
  [140, 86, 75],
  [227, 119, 194],
  [127, 127, 127],
  [188, 189, 34],
  [23, 190, 207]
];

/**
 * Snap tolerance (meters) used when deciding whether two polygons are
 * neighbors. Guards against tiny gaps/slivers in the Identity output.
 */
export const ADJACENCY_TOLERANCE_METERS = 5;
