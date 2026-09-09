import type MapView from "@arcgis/core/views/MapView";
import type GeoJSONLayer from "@arcgis/core/layers/GeoJSONLayer";
import type GraphicsLayer from "@arcgis/core/layers/GraphicsLayer";

import type { DistrictingStore } from "./store";
import { ID_FIELD } from "./config";

export type StatusFn = (message: string, kind?: "info" | "warn" | "error") => void;

/**
 * Wires click-to-toggle selection. Hit-tests both the base GeoJSON layer and
 * the overlay so already-colored units remain clickable. Contiguity and
 * lock rules are enforced by the store; we just surface the feedback.
 */
export function enableSelection(
  view: MapView,
  baseLayer: GeoJSONLayer,
  overlay: GraphicsLayer,
  store: DistrictingStore,
  status: StatusFn
): void {
  view.on("click", async (event) => {
    const response = await view.hitTest(event, {
      include: [overlay, baseLayer]
    });

    const id = extractId(response.results, baseLayer, overlay);
    if (id === undefined) return;

    const result = store.toggleWorking(id);
    if (!result.ok) {
      status(result.reason ?? "Action not allowed.", "warn");
    } else {
      status("");
    }
  });

  // Pointer cursor feedback over selectable units.
  view.on("pointer-move", async (event) => {
    const response = await view.hitTest(event, { include: [overlay, baseLayer] });
    const hit = extractId(response.results, baseLayer, overlay) !== undefined;
    if (view.container) {
      view.container.style.cursor = hit ? "pointer" : "default";
    }
  });
}

function extractId(
  results: __esri.MapViewViewHit[],
  baseLayer: GeoJSONLayer,
  overlay: GraphicsLayer
): number | undefined {
  for (const r of results) {
    if (r.type !== "graphic") continue;
    const g = r.graphic;
    if (g.layer === overlay) {
      const id = Number(g.attributes?.id);
      if (Number.isFinite(id)) return id;
    }
    if (g.layer === baseLayer) {
      const raw = g.attributes?.[ID_FIELD] ?? g.attributes?.[baseLayer.objectIdField];
      const id = Number(raw);
      if (Number.isFinite(id)) return id;
    }
  }
  return undefined;
}
