import GraphicsLayer from "@arcgis/core/layers/GraphicsLayer";
import Graphic from "@arcgis/core/Graphic";
import SimpleRenderer from "@arcgis/core/renderers/SimpleRenderer";
import SimpleFillSymbol from "@arcgis/core/symbols/SimpleFillSymbol";
import SimpleLineSymbol from "@arcgis/core/symbols/SimpleLineSymbol";
import type GeoJSONLayer from "@arcgis/core/layers/GeoJSONLayer";

import type { DistrictingStore } from "./store";
import { COLORS } from "./config";

function fill(
  color: [number, number, number, number],
  outline: [number, number, number, number],
  outlineWidth = 0.75
): SimpleFillSymbol {
  return new SimpleFillSymbol({
    color,
    outline: new SimpleLineSymbol({ color: outline, width: outlineWidth })
  });
}

/** Base renderer: everything starts as a neutral "unassigned" unit. */
export function baseRenderer(): SimpleRenderer {
  return new SimpleRenderer({
    symbol: fill(COLORS.unassigned, COLORS.unassignedOutline)
  });
}

/**
 * Draws working-selection and locked-district fills in an overlay above the
 * base GeoJSONLayer. Rebuilt from store state on every change (POC scale).
 */
export class OverlayRenderer {
  readonly layer = new GraphicsLayer({ title: "Districting Overlay" });

  constructor(
    private readonly store: DistrictingStore,
    _base: GeoJSONLayer
  ) {}

  render(): void {
    const graphics: Graphic[] = [];

    // Locked districts (opaque, colored by district).
    for (const district of this.store.getDistricts()) {
      const [r, g, b] = district.color;
      const symbol = fill(
        [r, g, b, 0.7],
        [r, g, b, 1],
        1
      );
      for (const id of district.featureIds) {
        const rec = this.store.records.get(id);
        if (!rec) continue;
        graphics.push(
          new Graphic({
            geometry: rec.geometry,
            symbol,
            attributes: { id, districtId: district.id }
          })
        );
      }
    }

    // Working selection (yellow), drawn last so it sits on top.
    const workingSymbol = fill(COLORS.working, COLORS.workingOutline, 2);
    for (const id of this.store.getWorking()) {
      const rec = this.store.records.get(id);
      if (!rec) continue;
      graphics.push(
        new Graphic({
          geometry: rec.geometry,
          symbol: workingSymbol,
          attributes: { id }
        })
      );
    }

    this.layer.removeAll();
    this.layer.addMany(graphics);
  }
}
