// Generates a synthetic, fully-contiguous grid of polygons over the Portland
// area so the POC runs out of the box. Replace public/data/parcels.geojson with
// your ArcGIS Pro "Identity" overlay export (WGS84 / EPSG:4326) when ready.
//
//   node scripts/generate-sample.mjs
//
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

const COLS = 12;
const ROWS = 10;
const XMIN = -122.85;
const XMAX = -122.45;
const YMIN = 45.40;
const YMAX = 45.65;

const dx = (XMAX - XMIN) / COLS;
const dy = (YMAX - YMIN) / ROWS;

const CITIES = ["Portland", "Beaverton", "Gresham", "Tigard", "Hillsboro"];
const COUNTIES = ["Multnomah", "Washington", "Clackamas"];
const SCHOOLS = ["PPS", "Beaverton SD", "Gresham-Barlow", "Tigard-Tualatin", "North Clackamas"];

const features = [];
let oid = 1;

for (let r = 0; r < ROWS; r++) {
  for (let c = 0; c < COLS; c++) {
    const x0 = XMIN + c * dx;
    const x1 = x0 + dx;
    const y0 = YMIN + r * dy;
    const y1 = y0 + dy;

    // Ring is closed and wound consistently (counter-clockwise).
    const ring = [
      [x0, y0],
      [x1, y0],
      [x1, y1],
      [x0, y1],
      [x0, y0]
    ];

    features.push({
      type: "Feature",
      properties: {
        OBJECTID: oid++,
        CITY: CITIES[(r + c) % CITIES.length],
        COUNTY: COUNTIES[Math.floor(c / (COLS / COUNTIES.length))] ?? COUNTIES[0],
        SCHOOL_DIST: SCHOOLS[(r * 3 + c) % SCHOOLS.length]
      },
      geometry: {
        type: "Polygon",
        coordinates: [ring]
      }
    });
  }
}

const geojson = {
  type: "FeatureCollection",
  crs: { type: "name", properties: { name: "urn:ogc:def:crs:OGC:1.3:CRS84" } },
  features
};

const out = "public/data/parcels.geojson";
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(geojson));
console.log(`Wrote ${features.length} polygons to ${out}`);
