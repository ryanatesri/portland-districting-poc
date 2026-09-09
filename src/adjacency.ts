import * as geometryEngine from "@arcgis/core/geometry/geometryEngine";
import type Polygon from "@arcgis/core/geometry/Polygon";
import type Extent from "@arcgis/core/geometry/Extent";

import type { FeatureRecord } from "./data";
import { ADJACENCY_TOLERANCE_METERS } from "./config";

/** Undirected neighbor graph: id -> set of touching ids. */
export type AdjacencyGraph = Map<number, Set<number>>;

/** Approx degrees of latitude per meter (good enough for a bbox pre-filter). */
const DEG_PER_METER = 1 / 111_320;

function extentsOverlap(a: Extent, b: Extent, pad: number): boolean {
  return !(
    a.xmax + pad < b.xmin - pad ||
    a.xmin - pad > b.xmax + pad ||
    a.ymax + pad < b.ymin - pad ||
    a.ymin - pad > b.ymax + pad
  );
}

/**
 * Build an adjacency graph from polygon geometries. Uses a bounding-box
 * pre-filter, then a tolerance-aware intersection test so tiny slivers/gaps in
 * the Identity output don't break contiguity.
 */
export function buildAdjacency(records: Map<number, FeatureRecord>): AdjacencyGraph {
  const items = [...records.values()];
  const graph: AdjacencyGraph = new Map();
  for (const r of items) graph.set(r.id, new Set());

  const pad = ADJACENCY_TOLERANCE_METERS * DEG_PER_METER;

  // Pre-buffer geometries by the tolerance so near-touching polygons register.
  const buffered = new Map<number, Polygon>();
  for (const r of items) {
    const buf = geometryEngine.geodesicBuffer(
      r.geometry,
      ADJACENCY_TOLERANCE_METERS,
      "meters"
    ) as Polygon | null;
    buffered.set(r.id, buf ?? r.geometry);
  }

  for (let i = 0; i < items.length; i++) {
    const a = items[i];
    const aExtent = a.geometry.extent;
    if (!aExtent) continue;

    for (let j = i + 1; j < items.length; j++) {
      const b = items[j];
      const bExtent = b.geometry.extent;
      if (!bExtent) continue;

      if (!extentsOverlap(aExtent, bExtent, pad)) continue;

      const touches = geometryEngine.intersects(
        buffered.get(a.id) as Polygon,
        b.geometry
      );
      if (touches) {
        graph.get(a.id)!.add(b.id);
        graph.get(b.id)!.add(a.id);
      }
    }
  }

  return graph;
}

/** Neighbors of a group (union of all adjacent ids not already in the group). */
export function neighborsOf(group: Set<number>, graph: AdjacencyGraph): Set<number> {
  const out = new Set<number>();
  for (const id of group) {
    const nbrs = graph.get(id);
    if (!nbrs) continue;
    for (const n of nbrs) {
      if (!group.has(n)) out.add(n);
    }
  }
  return out;
}

/** True if `candidate` touches at least one member of `group`. */
export function isAdjacentToGroup(
  candidate: number,
  group: Set<number>,
  graph: AdjacencyGraph
): boolean {
  const nbrs = graph.get(candidate);
  if (!nbrs) return false;
  for (const n of nbrs) if (group.has(n)) return true;
  return false;
}

/** True if the given set forms a single connected component. */
export function isConnected(group: Set<number>, graph: AdjacencyGraph): boolean {
  if (group.size <= 1) return true;

  const start = group.values().next().value as number;
  const seen = new Set<number>([start]);
  const stack = [start];

  while (stack.length) {
    const id = stack.pop() as number;
    const nbrs = graph.get(id);
    if (!nbrs) continue;
    for (const n of nbrs) {
      if (group.has(n) && !seen.has(n)) {
        seen.add(n);
        stack.push(n);
      }
    }
  }

  return seen.size === group.size;
}
