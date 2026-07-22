<script lang="ts">
  import { onMount } from 'svelte';
  import { getBasePath } from '$lib/base';
  import { api, type Transaction, type MonthSummary, type YearSummary, type Account, type AccountWithBalance } from '$lib/api/client';
  import { formatCents } from '$lib/format';
  import Button from '$lib/components/Button.svelte';
  import Card from '$lib/components/Card.svelte';

  // ── State ──────────────────────────────────────────────────────────────
  const now = new Date();
  let selectedYear = $state(now.getFullYear());
  let selectedMonth = $state<number | null>(null);
  let transactions = $state<Transaction[]>([]);
  let yearSummary = $state<YearSummary | null>(null);
  let monthSummary = $state<MonthSummary | null>(null);
  let loading = $state(true);
  let error = $state('');
  let yearInput = $state(String(now.getFullYear()));

  // ── Wealth state ─────────────────────────────────────────────────────────
  let wealthAccounts = $state<AccountWithBalance[]>([]);
  let wealthLoading = $state(false);
  let allAccounts = $state<Account[]>([]);
  let wealthHistory = $state<{ date: string; netWealth: number; accountCount: number }[]>([]);
  let wealthHistoryLoading = $state(false);

  let totalNetWorth = $derived(
    wealthAccounts.reduce((sum, a) => sum + (a.latestBalance ?? 0), 0)
  );

  let wealthByType = $derived.by(() => {
    const byType = new Map<string, { total: number; count: number }>();
    for (const acc of wealthAccounts) {
      const bal = acc.latestBalance ?? 0;
      const entry = byType.get(acc.type) ?? { total: 0, count: 0 };
      entry.total += bal;
      entry.count++;
      byType.set(acc.type, entry);
    }
    const result: { type: string; total: number; count: number; pct: number }[] = [];
    for (const [type, data] of byType) {
      result.push({ type, total: data.total, count: data.count, pct: totalNetWorth !== 0 ? data.total / totalNetWorth : 0 });
    }
    result.sort((a, b) => b.total - a.total);
    return result;
  });

  let maxTypeWealth = $derived(
    wealthByType.length > 0 ? Math.max(...wealthByType.map(w => Math.abs(w.total))) : 1
  );

  let wealthHistorySorted = $derived(
    [...wealthHistory].sort((a, b) => a.date.localeCompare(b.date))
  );

  let wealthHistMin = $derived(
    wealthHistorySorted.length > 0 ? Math.min(...wealthHistorySorted.map(w => w.netWealth)) : 0
  );
  let wealthHistMax = $derived(
    wealthHistorySorted.length > 0 ? Math.max(...wealthHistorySorted.map(w => w.netWealth)) : 1
  );
  let wealthHistRange = $derived(Math.max(1, wealthHistMax - wealthHistMin));
  let whStepX = $derived((WH_W - WH_PAD * 2) / Math.max(1, wealthHistorySorted.length - 1));

  const monthNames = [
    'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
    'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre',
  ];
  const monthNamesShort = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];

  // ── Derived: monthly aggregates for year bar chart ────────────────────
  let monthlyIncome = $derived.by(() => {
    const arr = new Array(12).fill(0);
    for (const tx of transactions) {
      if (tx.type === 'income') {
        const m = new Date(tx.date + 'T00:00:00').getMonth();
        arr[m] += tx.amount;
      }
    }
    return arr;
  });

  let monthlyExpenses = $derived.by(() => {
    const arr = new Array(12).fill(0);
    for (const tx of transactions) {
      if (tx.type === 'expense') {
        const m = new Date(tx.date + 'T00:00:00').getMonth();
        arr[m] += tx.amount;
      }
    }
    return arr;
  });

  let maxMonthly = $derived(
    Math.max(1, ...monthlyIncome, ...monthlyExpenses)
  );

  let hasData = $derived(transactions.length > 0);

  // ── Derived: category breakdown for selected month ────────────────────
  let monthTransactions = $derived(
    selectedMonth !== null
      ? transactions.filter(tx => new Date(tx.date + 'T00:00:00').getMonth() + 1 === selectedMonth)
      : []
  );

  interface CatTotal {
    category: string;
    total: number;
    count: number;
    pct: number;
  }

  let expenseCategories = $derived.by(() => {
    const map = new Map<string, number>();
    let count = 0;
    let grandTotal = 0;
    for (const tx of monthTransactions) {
      if (tx.type === 'expense') {
        map.set(tx.category, (map.get(tx.category) ?? 0) + tx.amount);
        grandTotal += tx.amount;
        count++;
      }
    }
    const cats: CatTotal[] = [];
    for (const [category, total] of map) {
      cats.push({ category, total, count, pct: grandTotal > 0 ? total / grandTotal : 0 });
    }
    cats.sort((a, b) => b.total - a.total);
    return { cats, grandTotal, count };
  });

  let incomeCategories = $derived.by(() => {
    const map = new Map<string, number>();
    let count = 0;
    let grandTotal = 0;
    for (const tx of monthTransactions) {
      if (tx.type === 'income') {
        map.set(tx.category, (map.get(tx.category) ?? 0) + tx.amount);
        grandTotal += tx.amount;
        count++;
      }
    }
    const cats: CatTotal[] = [];
    for (const [category, total] of map) {
      cats.push({ category, total, count, pct: grandTotal > 0 ? total / grandTotal : 0 });
    }
    cats.sort((a, b) => b.total - a.total);
    return { cats, grandTotal, count };
  });

  let maxExpenseCat = $derived(
    expenseCategories.cats.length > 0 ? Math.max(...expenseCategories.cats.map(c => c.total)) : 1
  );
  let maxIncomeCat = $derived(
    incomeCategories.cats.length > 0 ? Math.max(...incomeCategories.cats.map(c => c.total)) : 1
  );

  // ── Navigation ─────────────────────────────────────────────────────────
  function prevYear() {
    selectedYear--;
    selectedMonth = null;
    yearInput = String(selectedYear);
    loadData();
  }

  function nextYear() {
    selectedYear++;
    selectedMonth = null;
    yearInput = String(selectedYear);
    loadData();
  }

  function goToYear() {
    const y = parseInt(yearInput, 10);
    if (isNaN(y) || y < 1900 || y > 2100) {
      yearInput = String(selectedYear);
      return;
    }
    selectedYear = y;
    selectedMonth = null;
    loadData();
  }

  function handleYearKey(e: KeyboardEvent) {
    if (e.key === 'Enter') goToYear();
  }

  function goToMonth(m: number) {
    selectedMonth = m;
  }

  function goToYearOverview() {
    selectedMonth = null;
  }

  function prevMonth() {
    if (selectedMonth === null) return;
    if (selectedMonth === 1) {
      selectedMonth = 12;
      selectedYear--;
      yearInput = String(selectedYear);
      loadData();
    } else {
      selectedMonth--;
    }
  }

  function nextMonth() {
    if (selectedMonth === null) return;
    if (selectedMonth === 12) {
      selectedMonth = 1;
      selectedYear++;
      yearInput = String(selectedYear);
      loadData();
    } else {
      selectedMonth++;
    }
  }

  // ── Data loading ───────────────────────────────────────────────────────
  async function loadData() {
    loading = true;
    error = '';
    try {
      const [txs, ySummary] = await Promise.all([
        api.list({ year: selectedYear }),
        api.yearSummary(selectedYear),
      ]);
      transactions = txs;
      yearSummary = ySummary;

      if (selectedMonth !== null) {
        monthSummary = await api.monthSummary(selectedYear, selectedMonth);
      } else {
        monthSummary = null;
      }
    } catch (err) {
      error = err instanceof Error ? err.message : 'Errore nel caricamento';
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    loadData();
    loadWealth();
  });

  // ── Helpers ──────────────────────────────────────────────────────────────
  function accountName(accountId: string | undefined): string {
    if (!accountId) return '';
    const acc = allAccounts.find(a => a.id === accountId);
    return acc ? acc.name : '';
  }

  // ── Wealth loading ─────────────────────────────────────────────────────
  async function loadWealth() {
    wealthLoading = true;
    try {
      const [wealth, accs, wh] = await Promise.all([
        api.wealth(),
        api.listAccounts(),
        api.wealthHistory(),
      ]);
      wealthAccounts = wealth;
      allAccounts = accs;
      wealthHistory = wh;
    } catch {
      // silently fail — wealth is supplementary
    } finally {
      wealthLoading = false;
    }
  }

  // ── Chart helpers ──────────────────────────────────────────────────────
  const BAR_W = 30;
  const BAR_GAP = 6;
  const CHART_H = 180;
  const CHART_PAD = 4;

  // Wealth history chart dimensions
  const WH_W = 600;
  const WH_H = 160;
  const WH_PAD = 6;

  function barHeight(val: number, max: number): number {
    if (max === 0) return 0;
    return Math.max(3, (val / max) * (CHART_H - CHART_PAD * 2));
  }

  function formatShortCents(c: number): string {
    const eur = c / 100;
    if (eur >= 1000) return (eur / 1000).toFixed(1) + 'k';
    return eur.toFixed(0) + '€';
  }

  // Wealth history SVG path helpers
  function whAreaPath(): string {
    if (wealthHistorySorted.length < 2) return '';
    const stepX = (WH_W - WH_PAD * 2) / Math.max(1, wealthHistorySorted.length - 1);
    let d = `M${WH_PAD},${WH_H - WH_PAD}`;
    for (let i = 0; i < wealthHistorySorted.length; i++) {
      const x = WH_PAD + i * stepX;
      const y = WH_PAD + ((wealthHistMax - wealthHistorySorted[i].netWealth) / wealthHistRange) * (WH_H - WH_PAD * 2);
      d += `L${x},${y}`;
    }
    const lastX = WH_PAD + (wealthHistorySorted.length - 1) * stepX;
    d += `L${lastX},${WH_H - WH_PAD}Z`;
    return d;
  }

  function whLinePath(): string {
    if (wealthHistorySorted.length < 2) return '';
    const stepX = (WH_W - WH_PAD * 2) / Math.max(1, wealthHistorySorted.length - 1);
    let d = '';
    for (let i = 0; i < wealthHistorySorted.length; i++) {
      const x = WH_PAD + i * stepX;
      const y = WH_PAD + ((wealthHistMax - wealthHistorySorted[i].netWealth) / wealthHistRange) * (WH_H - WH_PAD * 2);
      d += i === 0 ? `M${x},${y}` : `L${x},${y}`;
    }
    return d;
  }
</script>

<svelte:head>
  <title>Panoramica — Bilancio</title>
</svelte:head>

<!-- ── Year Navigation ─────────────────────────────────────────────────── -->
<div class="nav-row">
  <div class="year-nav">
    <Button variant="ghost" onclick={prevYear}>◀</Button>
    <div class="year-input-group">
      <input
        type="text"
        inputmode="numeric"
        pattern="[0-9]*"
        class="year-input"
        bind:value={yearInput}
        onkeydown={handleYearKey}
        onblur={goToYear}
      />
    </div>
    <Button variant="ghost" onclick={nextYear}>▶</Button>
  </div>

  {#if selectedMonth !== null}
    <div class="month-indicator">
      <span class="month-indicator-label">{monthNames[selectedMonth - 1]}</span>
    </div>
  {/if}
</div>

<!-- ── Month sub-navigation ────────────────────────────────────────────── -->
{#if selectedMonth !== null}
  <div class="month-subnav">
    <button class="subnav-btn" onclick={prevMonth} aria-label="Mese precedente">&#x25C0;</button>
    <button class="subnav-label" onclick={goToYearOverview}>
      {monthNames[selectedMonth - 1]} {selectedYear}
    </button>
    <button class="subnav-btn" onclick={nextMonth} aria-label="Mese successivo">&#x25B6;</button>
    <button class="subnav-back" onclick={goToYearOverview}>
      &lt; Vista annuale
    </button>
  </div>
{/if}

<!-- ── Loading / Error ─────────────────────────────────────────────────── -->
{#if loading}
  <div class="loading">
    <p class="loading-text">Caricamento...</p>
  </div>
{:else if error}
  <Card variant="expense" padding="md">
    <p class="text-expense">{error}</p>
    <Button onclick={loadData}>Riprova</Button>
  </Card>
{:else}

  <!-- ════════════════════════════════════════════════════════════════════ -->
  <!-- YEAR OVERVIEW                                                       -->
  <!-- ════════════════════════════════════════════════════════════════════ -->
  {#if selectedMonth === null}

    <!-- Year summary cards -->
    {#if yearSummary}
      <div class="summary-cards">
        <div class="stat-card">
          <span class="stat-arrow stat-arrow-income">&#x25B2;</span>
          <div class="stat-body">
            <span class="stat-label">Entrate</span>
            <span class="stat-value text-income">{formatCents(yearSummary.totalIncome)}</span>
          </div>
        </div>
        <div class="stat-card">
          <span class="stat-arrow stat-arrow-expense">&#x25BC;</span>
          <div class="stat-body">
            <span class="stat-label">Uscite</span>
            <span class="stat-value text-expense">{formatCents(yearSummary.totalExpenses)}</span>
          </div>
        </div>
        <div class="stat-card">
          <span class="stat-symbol {yearSummary.totalDifference >= 0 ? 'symbol-positive' : 'symbol-negative'}">&#x25C6;</span>
          <div class="stat-body">
            <span class="stat-label">Saldo</span>
            <span class="stat-value {yearSummary.totalDifference >= 0 ? 'text-positive' : 'text-negative'}">
              {formatCents(yearSummary.totalDifference)}
            </span>
          </div>
        </div>
      </div>
    {/if}

    <!-- Wealth overview -->
    {#if wealthAccounts.length > 0}
      <div class="wealth-section">
        <div class="wealth-hero">
          <span class="wealth-hero-label">Patrimonio Netto</span>
          <span class="wealth-hero-amount {totalNetWorth >= 0 ? 'text-positive' : 'text-negative'}">
            {formatCents(totalNetWorth)}
          </span>
          <span class="wealth-hero-sub text-muted">{wealthAccounts.length} conti</span>
        </div>

        {#if wealthByType.length > 1}
          <div class="wealth-stacked-bar">
            {#each wealthByType as w}
              <div
                class="wealth-bar-segment"
                style="width: {Math.abs(w.pct) * 100}%"
                title="{w.type}: {formatCents(w.total)}"
              ></div>
            {/each}
          </div>
        {/if}

        <div class="wealth-type-list">
          {#each wealthByType as w}
            <div class="wealth-type-row">
              <span class="wealth-type-label">{w.type}</span>
              <span class="wealth-type-count">{w.count}</span>
              <div class="wealth-type-bar-track">
                <div
                  class="wealth-type-bar-fill"
                  style="width: {(Math.abs(w.total) / maxTypeWealth) * 100}%"
                ></div>
              </div>
              <span class="wealth-type-amount">{formatCents(w.total)}</span>
              <span class="wealth-type-pct">{(Math.abs(w.pct) * 100).toFixed(1)}%</span>
            </div>
          {/each}
        </div>
      </div>
    {/if}

    <!-- Wealth trend chart -->
    {#if wealthHistorySorted.length >= 2}
      <div class="chart-card">
        <div class="chart-header">
          <h3 class="section-title">Andamento Patrimonio Netto</h3>
          <span class="section-badge">{wealthHistorySorted.length} punti</span>
        </div>
        <svg viewBox="0 0 {WH_W} {WH_H + 24}" class="wealth-trend-chart">
          <!-- Grid lines -->
          <line x1={WH_PAD} y1={WH_PAD} x2={WH_W - WH_PAD} y2={WH_PAD} stroke="var(--color-border)" stroke-width="1" stroke-dasharray="4 4" />
          <line x1={WH_PAD} y1={WH_H / 2} x2={WH_W - WH_PAD} y2={WH_H / 2} stroke="var(--color-border)" stroke-width="1" stroke-dasharray="4 4" />
          <line x1={WH_PAD} y1={WH_H - WH_PAD} x2={WH_W - WH_PAD} y2={WH_H - WH_PAD} stroke="var(--color-border)" stroke-width="1" />
          <!-- Area -->
          <path d={whAreaPath()} fill="var(--color-income-dim)" />
          <!-- Line -->
          <path d={whLinePath()} fill="none" stroke="var(--color-positive)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
          <!-- Dots -->
          {#each wealthHistorySorted as w, i}
            {@const x = WH_PAD + i * whStepX}
            {@const y = WH_PAD + ((wealthHistMax - w.netWealth) / wealthHistRange) * (WH_H - WH_PAD * 2)}
            <circle cx={x} cy={y} r="2.5" fill="var(--color-positive)" stroke="var(--color-bg)" stroke-width="1">
              <title>{new Date(w.date + 'T00:00:00').toLocaleDateString('it-IT')}: {formatCents(w.netWealth)}</title>
            </circle>
          {/each}
        </svg>
      </div>
    {/if}

    <!-- Monthly bar chart -->
    {#if hasData}
      <div class="chart-card">
        <div class="chart-header">
          <h3 class="section-title">Andamento Mensile</h3>
          <div class="chart-legend">
            <span class="legend-item"><span class="legend-rect legend-income"></span> Entrate</span>
            <span class="legend-item"><span class="legend-rect legend-expense"></span> Uscite</span>
          </div>
        </div>
        <div class="chart-container">
          <div class="chart-y-labels">
            <span>{formatShortCents(maxMonthly)}</span>
            <span>{formatShortCents(Math.round(maxMonthly / 2))}</span>
            <span>0</span>
          </div>
          <svg
            viewBox="0 0 {12 * (BAR_W + BAR_GAP) + 16} {CHART_H + 28}"
            class="bar-chart"
          >
            <!-- Grid lines -->
            <line x1="0" y1={CHART_PAD} x2="100%" y2={CHART_PAD} stroke="var(--color-border)" stroke-width="1" stroke-dasharray="4 4" />
            <line x1="0" y1={CHART_H / 2} x2="100%" y2={CHART_H / 2} stroke="var(--color-border)" stroke-width="1" stroke-dasharray="4 4" />
            <line x1="0" y1={CHART_H - CHART_PAD} x2="100%" y2={CHART_H - CHART_PAD} stroke="var(--color-border)" stroke-width="1" />

            {#each monthNamesShort as name, i}
              {@const x = i * (BAR_W + BAR_GAP) + 8}
              {@const incomeH = barHeight(monthlyIncome[i], maxMonthly)}
              {@const expenseH = barHeight(monthlyExpenses[i], maxMonthly)}
              {@const incomeY = CHART_H - CHART_PAD - incomeH}
              {@const expenseY = CHART_H - CHART_PAD - expenseH}

              <!-- Income bar -->
              <rect
                x={x} y={incomeY}
                width={BAR_W / 2 - 2} height={incomeH}
                fill="var(--color-income)" rx="0"
                class="chart-bar"
                onclick={() => goToMonth(i + 1)}
                role="button" tabindex="0"
                onkeydown={(e) => { if (e.key === 'Enter') goToMonth(i + 1); }}
              >
                <title>Entrate {name}: {formatCents(monthlyIncome[i])}</title>
              </rect>

              <!-- Expense bar -->
              <rect
                x={x + BAR_W / 2 + 1} y={expenseY}
                width={BAR_W / 2 - 2} height={expenseH}
                fill="var(--color-expense)" rx="0"
                class="chart-bar"
                onclick={() => goToMonth(i + 1)}
                role="button" tabindex="0"
                onkeydown={(e) => { if (e.key === 'Enter') goToMonth(i + 1); }}
              >
                <title>Uscite {name}: {formatCents(monthlyExpenses[i])}</title>
              </rect>

              <!-- Month label -->
              <text
                x={x + BAR_W / 2} y={CHART_H + 16}
                text-anchor="middle" class="chart-label"
              >{name}</text>
            {/each}
          </svg>
        </div>
        <p class="chart-hint"># clicca una barra per esplorare il mese</p>
      </div>
    {:else}
      <div class="empty-state">
        <p class="empty-symbol">~ ~ ~</p>
        <p class="empty-text">Nessun dato per il {selectedYear}</p>
        <p class="empty-sub text-muted">Prova con un altro anno</p>
      </div>
    {/if}

  {:else}
    <!-- ══════════════════════════════════════════════════════════════════ -->
    <!-- MONTH DRILL-DOWN                                                  -->
    <!-- ══════════════════════════════════════════════════════════════════ -->

    <!-- Month summary cards -->
    {#if monthSummary}
      <div class="summary-cards">
        <div class="stat-card">
          <span class="stat-arrow stat-arrow-income">&#x25B2;</span>
          <div class="stat-body">
            <span class="stat-label">Entrate</span>
            <span class="stat-value text-income">{formatCents(monthSummary.totalIncome)}</span>
          </div>
        </div>
        <div class="stat-card">
          <span class="stat-arrow stat-arrow-expense">&#x25BC;</span>
          <div class="stat-body">
            <span class="stat-label">Uscite</span>
            <span class="stat-value text-expense">{formatCents(monthSummary.totalExpenses)}</span>
          </div>
        </div>
        <div class="stat-card">
          <span class="stat-symbol {monthSummary.difference >= 0 ? 'symbol-positive' : 'symbol-negative'}">&#x25C6;</span>
          <div class="stat-body">
            <span class="stat-label">Saldo</span>
            <span class="stat-value {monthSummary.difference >= 0 ? 'text-positive' : 'text-negative'}">
              {formatCents(monthSummary.difference)}
            </span>
          </div>
        </div>
      </div>
    {/if}

    <!-- ── Expense categories ────────────────────────────────────────── -->
    {#if expenseCategories.cats.length > 0}
      <div class="section-card">
        <div class="section-card-header">
          <h3 class="section-title">Uscite per Categoria</h3>
          <span class="section-badge">{expenseCategories.count} trans.</span>
        </div>
        <p class="section-subtitle">Totale {formatCents(expenseCategories.grandTotal)}</p>

        <div class="cat-chart">
          {#each expenseCategories.cats as cat}
            <div class="cat-row">
              <span class="cat-name">{cat.category}</span>
              <div class="cat-bar-track">
                <div
                  class="cat-bar-fill cat-bar-expense"
                  style="width: {(cat.total / maxExpenseCat) * 100}%"
                ></div>
              </div>
              <span class="cat-amount">{formatCents(cat.total)}</span>
              <span class="cat-pct">{(cat.pct * 100).toFixed(1)}%</span>
            </div>
          {/each}
        </div>
      </div>
    {/if}

    <!-- ── Income categories ─────────────────────────────────────────── -->
    {#if incomeCategories.cats.length > 0}
      <div class="section-card">
        <div class="section-card-header">
          <h3 class="section-title">Entrate per Categoria</h3>
          <span class="section-badge">{incomeCategories.count} trans.</span>
        </div>
        <p class="section-subtitle">Totale {formatCents(incomeCategories.grandTotal)}</p>

        <div class="cat-chart">
          {#each incomeCategories.cats as cat}
            <div class="cat-row">
              <span class="cat-name">{cat.category}</span>
              <div class="cat-bar-track">
                <div
                  class="cat-bar-fill cat-bar-income"
                  style="width: {(cat.total / maxIncomeCat) * 100}%"
                ></div>
              </div>
              <span class="cat-amount">{formatCents(cat.total)}</span>
              <span class="cat-pct">{(cat.pct * 100).toFixed(1)}%</span>
            </div>
          {/each}
        </div>
      </div>
    {/if}

    <!-- ── All transactions for the month ──────────────────────────────── -->
    {#if monthTransactions.length > 0}
      <div class="section-card">
        <div class="section-card-header">
          <h3 class="section-title">Transazioni</h3>
          <span class="section-badge">{monthTransactions.length} voci</span>
        </div>
        <div class="tx-list">
          {#each monthTransactions as tx (tx.id)}
            <div class="tx-row">
              <span class="tx-date">
                {new Date(tx.date + 'T00:00:00').toLocaleDateString('it-IT', { day: '2-digit', month: 'short' })}
              </span>
              <span class="tx-cat">{tx.category}</span>
              {#if tx.description}
                <span class="tx-desc text-muted">{tx.description}</span>
              {:else}
                <span class="tx-desc-empty"></span>
              {/if}
              {#if tx.accountId}
                <span class="tx-account text-muted">→ {accountName(tx.accountId)}</span>
              {/if}
              <span class="tx-amount {tx.type === 'income' ? 'text-income' : 'text-expense'}">
                {tx.type === 'income' ? '+' : '–'}{formatCents(tx.amount)}
              </span>
            </div>
          {/each}
        </div>
      </div>
    {/if}

  {/if}
{/if}

<style>
  /* ── Navigation ────────────────────────────────────────────────────────── */
  .nav-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: var(--space-lg);
    flex-wrap: wrap;
    gap: var(--space-sm);
  }
  .year-nav {
    display: flex;
    align-items: center;
    gap: var(--space-xs);
  }
  .year-input-group {
    min-width: 5.5rem;
    text-align: center;
  }
  .year-input {
    width: 5.5rem;
    padding: 0.25rem 0.5rem;
    font-size: var(--text-base);
    font-weight: 700;
    text-align: center;
    border: 1px solid var(--color-border);
    background: var(--color-bg);
    color: var(--color-text);
    font-family: var(--font-mono);
    outline: none;
    transition: border-color 0.1s;
  }
  .year-input:focus {
    border-color: var(--color-primary);
  }
  .month-indicator {
    display: flex;
    align-items: center;
    gap: var(--space-xs);
  }
  .month-indicator-label {
    font-size: var(--text-xs);
    font-weight: 500;
    color: var(--color-text-secondary);
    padding: 0.25rem 0.5rem;
    background: var(--color-surface-raised);
  }

  .month-subnav {
    display: flex;
    align-items: center;
    gap: var(--space-xs);
    margin-bottom: var(--space-lg);
    flex-wrap: wrap;
  }
  .subnav-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 30px;
    border: 1px solid var(--color-border);
    background: var(--color-surface);
    color: var(--color-text-secondary);
    cursor: pointer;
    transition: all 0.1s;
    font-family: var(--font-mono);
    font-size: var(--text-xs);
  }
  .subnav-btn:hover {
    border-color: var(--color-primary);
    color: var(--color-primary);
  }
  .subnav-label {
    padding: 0.25rem 0.5rem;
    font-size: var(--text-xs);
    font-weight: 600;
    color: var(--color-text);
    border: 1px solid var(--color-border);
    background: var(--color-surface-raised);
    cursor: pointer;
    transition: background 0.1s;
    font-family: var(--font-mono);
  }
  .subnav-label:hover {
    background: var(--color-border);
  }
  .subnav-back {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    margin-left: auto;
    padding: 0.25rem 0.5rem;
    font-size: var(--text-xs);
    font-weight: 500;
    color: var(--color-text-secondary);
    border: 1px solid var(--color-border);
    background: var(--color-surface);
    cursor: pointer;
    transition: all 0.1s;
    font-family: var(--font-mono);
  }
  .subnav-back:hover {
    border-color: var(--color-primary);
    color: var(--color-primary);
  }

  /* ── Loading ────────────────────────────────────────────────────────────── */
  .loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-md);
    padding: var(--space-2xl);
    color: var(--color-text-secondary);
    font-size: var(--text-sm);
  }
  .loading-text {
    font-family: var(--font-mono);
  }

  /* ── Summary stat cards ─────────────────────────────────────────────────── */
  .summary-cards {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: var(--space-md);
    margin-bottom: var(--space-lg);
  }
  .stat-card {
    display: flex;
    align-items: center;
    gap: var(--space-md);
    padding: var(--space-md);
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    transition: border-color 0.1s;
  }
  .stat-card:hover {
    border-color: var(--color-text-secondary);
  }
  .stat-arrow {
    font-size: 14px;
    flex-shrink: 0;
  }
  .stat-arrow-income { color: var(--color-income); }
  .stat-arrow-expense { color: var(--color-expense); }
  .stat-symbol { font-size: 12px; flex-shrink: 0; }
  .symbol-positive { color: var(--color-positive); }
  .symbol-negative { color: var(--color-negative); }
  .stat-body {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
    min-width: 0;
  }
  .stat-label {
    font-size: 10px;
    font-weight: 500;
    color: var(--color-text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    font-family: var(--font-mono);
  }
  .stat-value {
    font-family: var(--font-mono);
    font-weight: 700;
    font-size: var(--text-sm);
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* ── Wealth overview ──────────────────────────────────────────────────────── */
  .wealth-section {
    padding: var(--space-lg);
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    margin-bottom: var(--space-lg);
  }

  .wealth-hero {
    text-align: center;
    padding-bottom: var(--space-lg);
    border-bottom: 1px solid var(--color-border);
    margin-bottom: var(--space-lg);
  }
  .wealth-hero-label {
    display: block;
    font-size: 10px;
    font-weight: 500;
    color: var(--color-text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-bottom: var(--space-xs);
    font-family: var(--font-mono);
  }
  .wealth-hero-amount {
    display: block;
    font-family: var(--font-mono);
    font-weight: 700;
    font-size: var(--text-xl);
    margin-bottom: var(--space-xs);
  }
  .wealth-hero-sub {
    font-size: var(--text-sm);
    font-family: var(--font-mono);
  }

  .wealth-stacked-bar {
    display: flex;
    height: 6px;
    overflow: hidden;
    margin-bottom: var(--space-md);
    background: var(--color-border);
  }
  .wealth-bar-segment {
    height: 100%;
    transition: width 0.3s ease;
    min-width: 2px;
  }
  .wealth-bar-segment:nth-child(1) { background: var(--blue-500); }
  .wealth-bar-segment:nth-child(2) { background: var(--orange-500); }
  .wealth-bar-segment:nth-child(3) { background: var(--grey-500); }
  .wealth-bar-segment:nth-child(4) { background: var(--grey-400); }
  .wealth-bar-segment:nth-child(5) { background: var(--grey-300); }

  .wealth-type-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
  }
  .wealth-type-row {
    display: grid;
    grid-template-columns: 1fr 2rem 1fr 7rem 3.5rem;
    align-items: center;
    gap: var(--space-sm);
    font-size: var(--text-xs);
  }
  .wealth-type-label { font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-family: var(--font-mono); }
  .wealth-type-count {
    font-size: 10px;
    color: var(--color-text-secondary);
    text-align: center;
    font-family: var(--font-mono);
  }
  .wealth-type-bar-track { height: 12px; background: var(--color-border); overflow: hidden; }
  .wealth-type-bar-fill { height: 100%; transition: width 0.3s ease; min-width: 3px; background: var(--blue-500); }
  .wealth-type-amount { font-family: var(--font-mono); font-weight: 600; text-align: right; font-size: var(--text-xs); }
  .wealth-type-pct { font-family: var(--font-mono); color: var(--color-text-secondary); text-align: right; font-size: 10px; }

  /* ── Chart card ─────────────────────────────────────────────────────────── */
  .chart-card {
    padding: var(--space-lg);
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    margin-bottom: var(--space-md);
  }
  .chart-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: var(--space-md);
    flex-wrap: wrap;
    gap: var(--space-sm);
  }
  .section-title {
    font-size: var(--text-sm);
    font-weight: 600;
    font-family: var(--font-mono);
  }
  .section-subtitle {
    font-size: 10px;
    color: var(--color-text-secondary);
    margin-bottom: var(--space-md);
    font-family: var(--font-mono);
  }

  .chart-container {
    width: 100%;
    overflow-x: auto;
    display: flex;
    align-items: flex-end;
  }
  .chart-y-labels {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    height: 180px;
    padding-right: 6px;
    padding-bottom: 28px;
    font-size: 10px;
    color: var(--color-text-secondary);
    font-family: var(--font-mono);
    text-align: right;
    flex-shrink: 0;
  }
  .bar-chart {
    width: calc(100% - 2.5rem);
    height: 208px;
    display: block;
  }
  .chart-bar {
    cursor: pointer;
    transition: opacity 0.15s;
  }
  .chart-bar:hover {
    opacity: 0.7;
  }
  .chart-label {
    font-size: 9px;
    fill: var(--color-text-secondary);
    font-family: var(--font-mono);
  }
  .chart-legend {
    display: flex;
    gap: var(--space-md);
    font-size: 10px;
    color: var(--color-text-secondary);
    font-family: var(--font-mono);
  }
  .legend-item {
    display: flex;
    align-items: center;
    gap: 0.3rem;
  }
  .legend-rect {
    display: inline-block;
    width: 8px;
    height: 8px;
  }
  .legend-income { background: var(--color-income); }
  .legend-expense { background: var(--color-expense); }
  .chart-hint {
    margin-top: var(--space-sm);
    font-size: 10px;
    color: var(--color-text-dim);
    font-family: var(--font-mono);
    text-align: center;
  }

  .wealth-trend-chart {
    width: 100%;
    height: 184px;
    display: block;
  }

  /* ── Empty state ────────────────────────────────────────────────────────── */
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-sm);
    padding: var(--space-2xl);
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    text-align: center;
  }
  .empty-symbol {
    color: var(--color-text-dim);
    font-family: var(--font-mono);
    font-size: var(--text-lg);
    margin-bottom: var(--space-sm);
  }
  .empty-text {
    font-size: var(--text-sm);
    font-weight: 600;
    color: var(--color-text);
    font-family: var(--font-mono);
  }
  .empty-sub {
    font-size: var(--text-xs);
    font-family: var(--font-mono);
  }

  /* ── Category breakdown ─────────────────────────────────────────────────── */
  .section-card {
    padding: var(--space-lg);
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    margin-bottom: var(--space-md);
  }
  .section-card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: var(--space-xs);
    flex-wrap: wrap;
    gap: var(--space-xs);
  }
  .section-badge {
    font-size: 10px;
    font-weight: 500;
    color: var(--color-text-secondary);
    padding: 0.125rem 0.4rem;
    background: var(--color-surface-raised);
    font-family: var(--font-mono);
  }

  .cat-chart {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
  }
  .cat-row {
    display: grid;
    grid-template-columns: 8rem 1fr 7rem 3.5rem;
    align-items: center;
    gap: var(--space-sm);
    font-size: var(--text-xs);
  }
  .cat-name {
    font-weight: 500;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-family: var(--font-mono);
  }
  .cat-bar-track {
    height: 18px;
    background: var(--color-border);
    overflow: hidden;
  }
  .cat-bar-fill {
    height: 100%;
    transition: width 0.3s ease;
    min-width: 3px;
  }
  .cat-bar-expense {
    background: var(--color-expense);
  }
  .cat-bar-income {
    background: var(--color-income);
  }
  .cat-amount {
    font-family: var(--font-mono);
    font-weight: 600;
    text-align: right;
    font-size: var(--text-xs);
  }
  .cat-pct {
    font-family: var(--font-mono);
    color: var(--color-text-secondary);
    text-align: right;
    font-size: 10px;
  }

  /* ── Transaction list ───────────────────────────────────────────────────── */
  .tx-list {
    display: flex;
    flex-direction: column;
    gap: 0;
    margin-top: var(--space-sm);
  }
  .tx-row {
    display: grid;
    grid-template-columns: 4.5rem 1fr 1fr 1fr 7rem;
    align-items: center;
    gap: var(--space-sm);
    padding: 0.4rem 0;
    border-bottom: 1px solid var(--color-border);
    font-size: var(--text-xs);
  }
  .tx-row:last-child {
    border-bottom: none;
  }
  .tx-date {
    font-size: 10px;
    color: var(--color-text-secondary);
    font-family: var(--font-mono);
  }
  .tx-cat {
    font-weight: 500;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-family: var(--font-mono);
  }
  .tx-desc {
    font-size: 10px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--color-text-secondary);
    font-family: var(--font-mono);
  }
  .tx-desc-empty {
    /* empty cell for grid alignment */
  }
  .tx-account {
    font-size: 10px;
    color: var(--color-text-secondary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-family: var(--font-mono);
  }
  .tx-amount {
    font-family: var(--font-mono);
    font-weight: 600;
    text-align: right;
    font-size: var(--text-xs);
  }

  /* ── Responsive ─────────────────────────────────────────────────────────── */
  @media (max-width: 640px) {
    .summary-cards {
      grid-template-columns: 1fr;
    }
    .stat-card {
      gap: var(--space-sm);
      padding: var(--space-sm) var(--space-md);
    }
    .stat-value {
      font-size: var(--text-xs);
    }
    .cat-row {
      grid-template-columns: 5rem 1fr 5rem 2.5rem;
    }
    .tx-row {
      grid-template-columns: 3rem 1fr 1fr 5rem;
    }
    .tx-desc {
      display: none;
    }
    .tx-desc-empty {
      display: none;
    }
    .tx-account {
      display: none;
    }
    .chart-card, .section-card {
      padding: var(--space-md);
    }
  }
</style>