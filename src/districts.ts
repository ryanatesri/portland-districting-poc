import type { DistrictingStore } from "./store";
import type { StatusFn } from "./selection";

const nf = new Intl.NumberFormat("en-US");
const nf1 = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });

/** Renders the locked-district list and the coverage / finish-reset card. */
export class DistrictsPanel {
  constructor(
    private readonly listEl: HTMLElement,
    private readonly coverageEl: HTMLElement,
    private readonly store: DistrictingStore,
    private readonly status: StatusFn
  ) {
    this.buildCoverage();
    this.store.subscribe(() => this.render());
    this.render();
  }

  private buildCoverage(): void {
    this.coverageEl.innerHTML = `
      <h2>Coverage</h2>
      <div class="progress">
        <div class="progress-head"><span>Units assigned</span><span data-cov-label>0 / 0</span></div>
        <div class="bar"><div class="bar-fill" data-cov-bar></div></div>
      </div>
      <div class="actions">
        <button class="btn primary" data-finish disabled>Finish</button>
        <button class="btn danger" data-reset>Reset all</button>
      </div>
    `;

    this.coverageEl.querySelector("[data-finish]")!.addEventListener("click", () => {
      const c = this.store.coverage();
      if (!c.complete) {
        this.status("Every unit must be assigned before finishing.", "warn");
        return;
      }
      const districts = this.store.getDistricts();
      this.status(
        `Complete: ${districts.length} districts cover all ${c.total} units.`,
        "info"
      );
    });

    this.coverageEl.querySelector("[data-reset]")!.addEventListener("click", () => {
      if (confirm("Reset all districts and selections?")) {
        this.store.reset();
        this.status("Session reset.");
      }
    });
  }

  private render(): void {
    this.renderList();
    this.renderCoverage();
  }

  private renderList(): void {
    const districts = this.store.getDistricts();

    if (districts.length === 0) {
      this.listEl.innerHTML = `<h2>Districts</h2><p class="empty">No districts locked yet.</p>`;
      return;
    }

    const rows = districts
      .map((d) => {
        const [r, g, b] = d.color;
        return `
          <li class="district-row">
            <span class="swatch" style="background: rgb(${r},${g},${b})"></span>
            <span class="district-name">${d.name}</span>
            <span class="district-meta">
              ${nf.format(d.population)} pop &middot; ${nf1.format(d.areaSqMi)} sq mi &middot; ${d.featureIds.length} units
            </span>
            <button class="link-btn" data-unlock="${d.id}" title="Unlock">&times;</button>
          </li>`;
      })
      .join("");

    this.listEl.innerHTML = `<h2>Districts (${districts.length})</h2><ul class="district-list">${rows}</ul>`;

    this.listEl.querySelectorAll<HTMLButtonElement>("[data-unlock]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = Number(btn.dataset.unlock);
        this.store.unlockDistrict(id);
        this.status(`District ${id} unlocked.`);
      });
    });
  }

  private renderCoverage(): void {
    const c = this.store.coverage();
    const pct = c.total > 0 ? Math.round((c.assigned / c.total) * 100) : 0;

    const bar = this.coverageEl.querySelector<HTMLElement>("[data-cov-bar]")!;
    bar.style.width = `${pct}%`;
    bar.classList.toggle("met", c.complete);

    this.coverageEl.querySelector("[data-cov-label]")!.textContent =
      `${nf.format(c.assigned)} / ${nf.format(c.total)} (${pct}%)`;

    const finish = this.coverageEl.querySelector<HTMLButtonElement>("[data-finish]")!;
    finish.disabled = !c.complete;
  }
}
