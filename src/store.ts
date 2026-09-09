import type { FeatureRecord } from "./data";
import {
  type AdjacencyGraph,
  isAdjacentToGroup,
  isConnected
} from "./adjacency";
import { DEFAULT_THRESHOLDS, DISTRICT_PALETTE } from "./config";

export interface District {
  id: number;
  name: string;
  population: number;
  areaSqMi: number;
  featureIds: number[];
  color: [number, number, number];
}

export interface Totals {
  population: number;
  areaSqMi: number;
  count: number;
}

export interface Thresholds {
  minPopulation: number;
  minAreaSqMi: number;
}

export interface ActionResult {
  ok: boolean;
  reason?: string;
}

type Listener = () => void;

/**
 * Single source of truth for the districting session. UI modules subscribe to
 * change notifications and re-render from the getters below.
 */
export class DistrictingStore {
  readonly records: Map<number, FeatureRecord>;
  private readonly graph: AdjacencyGraph;

  thresholds: Thresholds = { ...DEFAULT_THRESHOLDS };

  private working = new Set<number>();
  private assignments = new Map<number, number>(); // featureId -> districtId
  private districts: District[] = [];
  private nextDistrictId = 1;

  private listeners = new Set<Listener>();

  constructor(records: Map<number, FeatureRecord>, graph: AdjacencyGraph) {
    this.records = records;
    this.graph = graph;
  }

  // --- subscriptions -------------------------------------------------------

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(): void {
    for (const fn of this.listeners) fn();
  }

  // --- selection -----------------------------------------------------------

  getWorking(): ReadonlySet<number> {
    return this.working;
  }

  isAssigned(id: number): boolean {
    return this.assignments.has(id);
  }

  districtIdOf(id: number): number | undefined {
    return this.assignments.get(id);
  }

  /** Toggle a feature in/out of the current working selection. */
  toggleWorking(id: number): ActionResult {
    if (!this.records.has(id)) return { ok: false, reason: "Unknown feature." };

    if (this.assignments.has(id)) {
      return {
        ok: false,
        reason: `Locked into District ${this.assignments.get(id)}.`
      };
    }

    if (this.working.has(id)) {
      // Removing: make sure the remaining group stays contiguous.
      const next = new Set(this.working);
      next.delete(id);
      if (!isConnected(next, this.graph)) {
        return {
          ok: false,
          reason: "Removing this unit would split the selection."
        };
      }
      this.working = next;
      this.emit();
      return { ok: true };
    }

    // Adding: first pick is free; later picks must touch the group.
    if (this.working.size > 0 && !isAdjacentToGroup(id, this.working, this.graph)) {
      return {
        ok: false,
        reason: "Selection must stay contiguous \u2014 pick an adjacent unit."
      };
    }

    this.working.add(id);
    this.emit();
    return { ok: true };
  }

  clearWorking(): void {
    if (this.working.size === 0) return;
    this.working.clear();
    this.emit();
  }

  // --- totals / coverage ---------------------------------------------------

  workingTotals(): Totals {
    let population = 0;
    let areaSqMi = 0;
    for (const id of this.working) {
      const r = this.records.get(id);
      if (!r) continue;
      population += r.population;
      areaSqMi += r.areaSqMi;
    }
    return { population, areaSqMi, count: this.working.size };
  }

  coverage(): { assigned: number; total: number; complete: boolean } {
    const total = this.records.size;
    const assigned = this.assignments.size;
    return { assigned, total, complete: total > 0 && assigned === total };
  }

  canLock(): boolean {
    const t = this.workingTotals();
    return (
      this.working.size > 0 &&
      isConnected(this.working, this.graph) &&
      t.population >= this.thresholds.minPopulation &&
      t.areaSqMi >= this.thresholds.minAreaSqMi
    );
  }

  // --- districts -----------------------------------------------------------

  getDistricts(): readonly District[] {
    return this.districts;
  }

  lockDistrict(): ActionResult {
    if (!this.canLock()) {
      return { ok: false, reason: "Thresholds not met or selection not contiguous." };
    }

    const t = this.workingTotals();
    const id = this.nextDistrictId++;
    const color = DISTRICT_PALETTE[(id - 1) % DISTRICT_PALETTE.length];
    const featureIds = [...this.working];

    for (const fid of featureIds) this.assignments.set(fid, id);

    this.districts.push({
      id,
      name: `District ${id}`,
      population: t.population,
      areaSqMi: t.areaSqMi,
      featureIds,
      color
    });

    this.working.clear();
    this.emit();
    return { ok: true };
  }

  /** Unlock a district and return its units to the unassigned pool. */
  unlockDistrict(districtId: number): ActionResult {
    const idx = this.districts.findIndex((d) => d.id === districtId);
    if (idx === -1) return { ok: false, reason: "District not found." };

    for (const fid of this.districts[idx].featureIds) this.assignments.delete(fid);
    this.districts.splice(idx, 1);
    this.emit();
    return { ok: true };
  }

  setThresholds(next: Partial<Thresholds>): void {
    this.thresholds = { ...this.thresholds, ...next };
    this.emit();
  }

  reset(): void {
    this.working.clear();
    this.assignments.clear();
    this.districts = [];
    this.nextDistrictId = 1;
    this.emit();
  }
}
