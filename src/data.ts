import GeoJSONLayer from "@arcgis/core/layers/GeoJSONLayer";
import * as geometryEngine from "@arcgis/core/geometry/geometryEngine";
import type Polygon from "@arcgis/core/geometry/Polygon";
import type Graphic from "@arcgis/core/Graphic";

import { ID_FIELD, PARCELS_URL, POPULATION_FIELD, POPULATION_MODEL } from "./config";

/** Per-feature record used throughout the app. */
export interface FeatureRecord {
  id: number;
  areaSqMi: number;
  population: number;
  geometry: Polygon;
  attributes: Record<string, unknown>;
}

export interface LoadedData {
  layer: GeoJSONLayer;
  records: Map<number, FeatureRecord>;
}

/** Deterministic hash -> 32-bit seed from a feature id. */
function seedFromId(id: number): number {
  // xmur3-ish mix so nearby ids don't produce nearby jitter
  let h = 2166136261 ^ id;
  h = Math.imul(h ^ (h >>> 15), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  h ^= h >>> 16;
  return h >>> 0;
}

/** mulberry32 PRNG -> deterministic float in [0, 1). */
function mulberry32(seed: number): number {
  let t = (seed += 0x6d2b79f5);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** Fabricate a stable population for a polygon from its id + area. */
function fabricatePopulation(id: number, areaSqMi: number): number {
  const r = mulberry32(seedFromId(id)); // deterministic per feature
  const jitter = 1 + (r * 2 - 1) * POPULATION_MODEL.jitter;
  const value = POPULATION_MODEL.base + areaSqMi * POPULATION_MODEL.perSqMi * jitter;
  return Math.max(0, Math.round(value));
}

/**
 * Load the client-side GeoJSON, then query every feature to compute geodesic
 * area (sq mi) and a fabricated, seeded population. Returns the layer plus a
 * registry keyed by the feature id.
 */
export async function loadParcels(): Promise<LoadedData> {
  const layer = new GeoJSONLayer({
    url: PARCELS_URL,
    // objectIdField lets ArcGIS build a stable id; source ids are preserved.
    outFields: ["*"],
    title: "Districting Units"
  });

  await layer.load();

  const query = layer.createQuery();
  query.where = "1=1";
  query.returnGeometry = true;
  query.outFields = ["*"];
  const { features } = await layer.queryFeatures(query);

  const records = new Map<number, FeatureRecord>();

  for (const feature of features as Graphic[]) {
    const geometry = feature.geometry as Polygon;
    if (!geometry) continue;

    const rawId = feature.attributes?.[ID_FIELD] ?? feature.attributes?.[layer.objectIdField];
    const id = Number(rawId);
    if (!Number.isFinite(id)) continue;

    const areaSqMi = Math.abs(
      geometryEngine.geodesicArea(geometry, "square-miles")
    );
    const rawPop = Number(feature.attributes?.[POPULATION_FIELD]);
    const population = Number.isFinite(rawPop)
      ? Math.max(0, Math.round(rawPop))
      : fabricatePopulation(id, areaSqMi);

    records.set(id, {
      id,
      areaSqMi,
      population,
      geometry,
      attributes: feature.attributes ?? {}
    });
  }

  return { layer, records };
}
