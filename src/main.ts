import "./styles.css";

import EsriMap from "@arcgis/core/Map";
import MapView from "@arcgis/core/views/MapView";
import Extent from "@arcgis/core/geometry/Extent";
import PopupTemplate from "@arcgis/core/PopupTemplate";

import { PORTLAND_EXTENT, INFO_FIELDS, LABEL_FIELD } from "./config";
import { loadParcels } from "./data";
import { buildAdjacency } from "./adjacency";
import { DistrictingStore } from "./store";
import { OverlayRenderer, baseRenderer } from "./render";
import { enableSelection, type StatusFn } from "./selection";
import { KpiPanel } from "./kpi";
import { DistrictsPanel } from "./districts";

const statusEl = document.getElementById("statusBar")!;
const status: StatusFn = (message, kind = "info") => {
  statusEl.textContent = message;
  statusEl.className = message ? `status ${kind}` : "";
};

async function main(): Promise<void> {
  status("Loading districting units\u2026");

  const map = new EsriMap({ basemap: "gray-vector" });

  const view = new MapView({
    container: "viewDiv",
    map,
    extent: new Extent(PORTLAND_EXTENT),
    constraints: { snapToZoom: false },
    popupEnabled: false
  });

  const { layer, records } = await loadParcels();
  layer.renderer = baseRenderer();
  layer.popupTemplate = new PopupTemplate({
    title: "Unit {" + LABEL_FIELD + "}",
    content: buildPopupContent
  });
  map.add(layer);

  if (records.size === 0) {
    status("No features found in data/units.geojson.", "error");
    return;
  }

  status(`Building adjacency for ${records.size} units\u2026`);
  const graph = buildAdjacency(records);

  const store = new DistrictingStore(records, graph);

  const overlay = new OverlayRenderer(store, layer);
  map.add(overlay.layer);
  store.subscribe(() => overlay.render());
  overlay.render();

  // Panels
  new KpiPanel(document.getElementById("kpi")!, store, status);
  new DistrictsPanel(
    document.getElementById("districts")!,
    document.getElementById("coverage")!,
    store,
    status
  );

  enableSelection(view, layer, overlay.layer, store, status);

  await view.when();
  await view.goTo(layer.fullExtent ?? new Extent(PORTLAND_EXTENT)).catch(() => undefined);
  status("");
}

function buildPopupContent(): string {
  return INFO_FIELDS.map(
    (f) => `<b>${f}:</b> {${f}}`
  ).join("<br/>");
}

main().catch((err) => {
  console.error(err);
  status(`Failed to start: ${err?.message ?? err}`, "error");
});
