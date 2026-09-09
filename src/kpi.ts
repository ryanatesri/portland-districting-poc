import type { DistrictingStore } from "./store";
import type { StatusFn } from "./selection";

const nf = new Intl.NumberFormat("en-US");
const nf1 = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });

/**
 * KPI card: live aggregation of the working selection with editable thresholds,
 * progress bars, and the Lock / Clear actions.
 */
export class KpiPanel {
  private popValue!: HTMLElement;
  private areaValue!: HTMLElement;
  private countValue!: HTMLElement;
  private popBar!: HTMLElement;
  private areaBar!: HTMLElement;
  private minPopInput!: HTMLInputElement;
  private minAreaInput!: HTMLInputElement;
  private lockBtn!: HTMLButtonElement;
  private clearBtn!: HTMLButtonElement;

  constructor(
    private readonly container: HTMLElement,
    private readonly store: DistrictingStore,
    private readonly status: StatusFn
  ) {
    this.build();
    this.store.subscribe(() => this.update());
    this.update();
  }

  private build(): void {
    this.container.innerHTML = `
      <h2>Working Selection</h2>
      <div class="stat-grid">
        <div class="stat"><span class="stat-label">Units</span><span class="stat-num" data-count>0</span></div>
        <div class="stat"><span class="stat-label">Population</span><span class="stat-num" data-pop>0</span></div>
        <div class="stat"><span class="stat-label">Area (sq mi)</span><span class="stat-num" data-area>0</span></div>
      </div>

      <div class="threshold-row">
        <label>Min population
          <input type="number" min="0" step="1000" data-min-pop />
        </label>
        <label>Min area (sq mi)
          <input type="number" min="0" step="1" data-min-area />
        </label>
      </div>

      <div class="progress">
        <div class="progress-head"><span>Population</span><span data-pop-pct>0%</span></div>
        <div class="bar"><div class="bar-fill" data-pop-bar></div></div>
      </div>
      <div class="progress">
        <div class="progress-head"><span>Area</span><span data-area-pct>0%</span></div>
        <div class="bar"><div class="bar-fill" data-area-bar></div></div>
      </div>

      <div class="actions">
        <button class="btn primary" data-lock disabled>Lock District</button>
        <button class="btn" data-clear>Clear</button>
      </div>
    `;

    this.countValue = this.container.querySelector("[data-count]")!;
    this.popValue = this.container.querySelector("[data-pop]")!;
    this.areaValue = this.container.querySelector("[data-area]")!;
    this.popBar = this.container.querySelector("[data-pop-bar]")!;
    this.areaBar = this.container.querySelector("[data-area-bar]")!;
    this.minPopInput = this.container.querySelector("[data-min-pop]")!;
    this.minAreaInput = this.container.querySelector("[data-min-area]")!;
    this.lockBtn = this.container.querySelector("[data-lock]")!;
    this.clearBtn = this.container.querySelector("[data-clear]")!;

    this.minPopInput.value = String(this.store.thresholds.minPopulation);
    this.minAreaInput.value = String(this.store.thresholds.minAreaSqMi);

    this.minPopInput.addEventListener("input", () => {
      const v = Number(this.minPopInput.value);
      if (Number.isFinite(v) && v >= 0) this.store.setThresholds({ minPopulation: v });
    });
    this.minAreaInput.addEventListener("input", () => {
      const v = Number(this.minAreaInput.value);
      if (Number.isFinite(v) && v >= 0) this.store.setThresholds({ minAreaSqMi: v });
    });

    this.lockBtn.addEventListener("click", () => {
      const res = this.store.lockDistrict();
      if (!res.ok) this.status(res.reason ?? "Cannot lock.", "warn");
      else this.status("District locked.", "info");
    });

    this.clearBtn.addEventListener("click", () => {
      this.store.clearWorking();
      this.status("");
    });
  }

  private update(): void {
    const t = this.store.workingTotals();
    const th = this.store.thresholds;

    this.countValue.textContent = nf.format(t.count);
    this.popValue.textContent = nf.format(t.population);
    this.areaValue.textContent = nf1.format(t.areaSqMi);

    const popPct = th.minPopulation > 0 ? t.population / th.minPopulation : 1;
    const areaPct = th.minAreaSqMi > 0 ? t.areaSqMi / th.minAreaSqMi : 1;
    this.applyBar(this.popBar, "[data-pop-pct]", popPct);
    this.applyBar(this.areaBar, "[data-area-pct]", areaPct);

    const canLock = this.store.canLock();
    this.lockBtn.disabled = !canLock;
    this.clearBtn.disabled = t.count === 0;
  }

  private applyBar(bar: HTMLElement, pctSel: string, ratio: number): void {
    const pct = Math.min(100, Math.round(ratio * 100));
    bar.style.width = `${pct}%`;
    bar.classList.toggle("met", ratio >= 1);
    const label = this.container.querySelector(pctSel);
    if (label) label.textContent = `${pct}%`;
  }
}
