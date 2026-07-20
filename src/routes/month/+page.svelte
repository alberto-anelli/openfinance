<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { getBasePath } from '$lib/base';
  import { api, type Transaction, type MonthSummary, type YearSummary, type Account } from '$lib/api/client';
  import { formatCents } from '$lib/format';
  import Button from '$lib/components/Button.svelte';
  import Card from '$lib/components/Card.svelte';
  import SummaryTable from '$lib/components/SummaryTable.svelte';
  import Toast from '$lib/components/Toast.svelte';

  // --- State ---
  const now = new Date();
  let currentYear = $state(now.getFullYear());
  let currentMonth = $state(now.getMonth() + 1);
  let transactions = $state<Transaction[]>([]);
  let monthSummary = $state<MonthSummary | null>(null);
  let yearSummary = $state<YearSummary | null>(null);
  let loading = $state(true);
  let error = $state('');
  let selectedCategory = $state<string | null>(null);
  let showYearTable = $state(false);
  let accounts = $state<Account[]>([]);
  let expandedId = $state<string | null>(null);
  let toastVisible = $state(false);
  let toastMessage = $state('');
  let toastType: 'success' | 'error' = $state('success');

  // --- Derived ---
  let categories = $derived(uniqCategories(transactions));

  let filteredTransactions = $derived(
    selectedCategory
      ? transactions.filter(tx => tx.category === selectedCategory)
      : transactions
  );

  // --- Functions ---
  function accountName(accountId: string | undefined): string {
    if (!accountId) return '';
    const acc = accounts.find(a => a.id === accountId);
    return acc ? acc.name : '';
  }

  function uniqCategories(txs: Transaction[]): string[] {
    const cats = new Set(txs.map(tx => tx.category));
    return Array.from(cats).sort();
  }

  function formatDate(dateStr: string): string {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('it-IT', { day: '2-digit', month: 'short' });
  }

  function prevMonth() {
    if (currentMonth === 1) {
      currentMonth = 12;
      currentYear--;
    } else {
      currentMonth--;
    }
    loadData();
  }

  function nextMonth() {
    if (currentMonth === 12) {
      currentMonth = 1;
      currentYear++;
    } else {
      currentMonth++;
    }
    loadData();
  }

  function toggleCategory(cat: string) {
    selectedCategory = selectedCategory === cat ? null : cat;
  }

  async function loadData() {
    loading = true;
    error = '';
    try {
      const [txs, mSummary, ySummary, accs] = await Promise.all([
        api.list({ year: currentYear, month: currentMonth }),
        api.monthSummary(currentYear, currentMonth),
        api.yearSummary(currentYear),
        api.listAccounts(),
      ]);
      transactions = txs;
      monthSummary = mSummary;
      yearSummary = ySummary;
      accounts = accs;
    } catch (err) {
      error = err instanceof Error ? err.message : 'Errore nel caricamento';
    } finally {
      loading = false;
    }
  }

  async function deleteTransaction(id: string) {
    if (!confirm('Eliminare questa voce?')) return;
    try {
      await api.delete(id);
      toastMessage = 'Voce eliminata';
      toastType = 'success';
      toastVisible = true;
      await loadData();
    } catch (err) {
      toastMessage = err instanceof Error ? err.message : 'Errore durante l\'eliminazione';
      toastType = 'error';
      toastVisible = true;
    }
  }

  function handleToastDismiss() {
    toastVisible = false;
  }

  function editUrl(tx: Transaction): string {
    const base = getBasePath();
    const route = tx.type === 'income' ? '/add-entry' : '/add-notes';
    return `${base}${route}?id=${tx.id}`;
  }

  function toggleExpand(id: string) {
    expandedId = expandedId === id ? null : id;
  }

  const monthNames = [
    'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
    'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre',
  ];

  onMount(loadData);
</script>

<svelte:head>
  <title>Riepilogo — Finanze</title>
</svelte:head>

<!-- 1. Month selector -->
<div class="month-selector">
  <Button variant="ghost" onclick={prevMonth}>◀</Button>
  <h2 class="month-title">
    {monthNames[currentMonth - 1]} {currentYear}
  </h2>
  <Button variant="ghost" onclick={nextMonth}>▶</Button>
</div>

<!-- Loading state -->
{#if loading}
  <div class="loading">
    <p>Caricamento...</p>
  </div>
  <!-- Error state -->
{:else if error}
  <Card variant="expense">
    <p class="text-expense">{error}</p>
    <Button onclick={loadData}>Riprova</Button>
  </Card>
{:else}
  <!-- 2. Category filter chips -->
  {#if categories.length > 0}
    <div class="filter-chips">
      <button
        class="chip {selectedCategory === null ? 'chip-active' : ''}"
        onclick={() => selectedCategory = null}
      >
        Tutte
      </button>
      {#each categories as cat}
        <button
          class="chip {selectedCategory === cat ? 'chip-active' : ''}"
          onclick={() => toggleCategory(cat)}
        >
          {cat}
        </button>
      {/each}
    </div>
  {/if}

  <!-- 3. Transactions list -->
  {#if filteredTransactions.length > 0}
    <div class="tx-list">
      {#each filteredTransactions as tx (tx.id)}
        <Card
          variant={tx.type === 'income' ? 'income' : 'expense'}
          padding="sm"
          class={expandedId === tx.id ? 'tx-expanded' : ''}
        >
          <div class="tx-row">
            <div
              class="tx-info"
              class:tx-info-clickable={!!tx.description}
              onclick={tx.description ? () => toggleExpand(tx.id) : undefined}
              role={tx.description ? 'button' : undefined}
            >
              <span class="tx-category">{tx.category}</span>
              <span class="tx-date text-muted">{formatDate(tx.date)}</span>
              {#if tx.accountId}
                <span class="tx-account text-muted">→ {accountName(tx.accountId)}</span>
              {/if}
            </div>
            <div class="tx-amount-group">
              <span
                class="tx-amount {tx.type === 'income' ? 'text-income' : 'text-expense'}"
              >
                {tx.type === 'income' ? '+' : '–'}{formatCents(tx.amount)}
              </span>
              <button
                class="tx-edit"
                onclick={() => goto(editUrl(tx))}
                aria-label="Modifica"
              >
                ✎
              </button>
              <button
                class="tx-delete"
                onclick={() => deleteTransaction(tx.id)}
                aria-label="Elimina"
              >
                ✕
              </button>
            </div>
          </div>
          {#if expandedId === tx.id && tx.description}
            <div class="tx-description">
              {tx.description}
            </div>
          {/if}
        </Card>
      {/each}
    </div>
  {:else}
    <Card padding="lg">
      <p class="empty-state text-muted">
        Nessuna voce per questo mese.
        <a href={getBasePath() + '/add-notes'}>Aggiungi una spesa</a>
        o
        <a href={getBasePath() + '/add-entry'}>un'entrata</a>.
      </p>
    </Card>
  {/if}

  <!-- 4. Month summary -->
  {#if monthSummary}
    <Card variant="summary" padding="md" class="summary-card">
      <div class="summary-grid">
        <div class="summary-item">
          <span class="summary-label">Entrate</span>
          <span class="summary-value text-income">{formatCents(monthSummary.totalIncome)}</span>
        </div>
        <div class="summary-item">
          <span class="summary-label">Uscite</span>
          <span class="summary-value text-expense">{formatCents(monthSummary.totalExpenses)}</span>
        </div>
        <div class="summary-item">
          <span class="summary-label">Differenza</span>
          <span
            class="summary-value {monthSummary.difference >= 0 ? 'text-positive' : 'text-negative'}"
          >
            {formatCents(monthSummary.difference)}
          </span>
        </div>
      </div>
    </Card>
  {/if}

  <!-- 5. Year summary compact -->
  {#if yearSummary}
    <Card padding="md" class="year-compact">
      <h3 class="year-title">Anno {yearSummary.year}</h3>
      <div class="summary-grid">
        <div class="summary-item">
          <span class="summary-label">Totale entrate</span>
          <span class="summary-value text-income">{formatCents(yearSummary.totalIncome)}</span>
        </div>
        <div class="summary-item">
          <span class="summary-label">Totale uscite</span>
          <span class="summary-value text-expense">{formatCents(yearSummary.totalExpenses)}</span>
        </div>
        <div class="summary-item">
          <span class="summary-label">Saldo</span>
          <span
            class="summary-value {yearSummary.totalDifference >= 0 ? 'text-positive' : 'text-negative'}"
          >
            {formatCents(yearSummary.totalDifference)}
          </span>
        </div>
      </div>
    </Card>
  {/if}

  <!-- 6. Expandable annual table -->
  {#if yearSummary}
    <Card padding="md" class="year-table-section">
      <button
        class="accordion-toggle"
        onclick={() => showYearTable = !showYearTable}
      >
        <span>Dettaglio mensile</span>
        <span class="accordion-arrow">{showYearTable ? '▲' : '▼'}</span>
      </button>
      {#if showYearTable}
        <div class="accordion-content">
          <SummaryTable summary={yearSummary} />
        </div>
      {/if}
    </Card>
  {/if}
{/if}

<Toast
  message={toastMessage}
  type={toastType}
  visible={toastVisible}
  ondismiss={handleToastDismiss}
/>

<style>
  .month-selector {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-md);
    margin-bottom: var(--space-lg);
  }
  .month-title {
    min-width: 12rem;
    text-align: center;
  }

  .loading {
    text-align: center;
    padding: var(--space-2xl);
    color: var(--color-text-secondary);
  }

  .filter-chips {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-xs);
    margin-bottom: var(--space-md);
  }
  .chip {
    padding: 0.25rem 0.75rem;
    font-size: var(--text-xs);
    font-weight: 500;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-full);
    background: var(--color-surface);
    color: var(--color-text-secondary);
    cursor: pointer;
    transition: all 0.15s;
    font-family: inherit;
  }
  .chip:hover {
    border-color: var(--color-primary);
    color: var(--color-primary);
  }
  .chip-active {
    background: var(--color-primary);
    color: #fff;
    border-color: var(--color-primary);
  }
  .chip-active:hover {
    color: #fff;
  }

  .tx-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
    margin-bottom: var(--space-lg);
  }
  .tx-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-sm);
  }
  .tx-info {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
    min-width: 0;
  }
  .tx-category {
    font-weight: 500;
    font-size: var(--text-sm);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .tx-date {
    font-size: var(--text-xs);
  }
  .tx-account {
    font-size: var(--text-xs);
    font-style: italic;
  }
  .tx-amount-group {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    flex-shrink: 0;
  }
  .tx-amount {
    font-family: var(--font-mono);
    font-weight: 600;
    font-size: var(--text-sm);
    white-space: nowrap;
  }
  .tx-delete {
    background: none;
    border: none;
    color: var(--color-text-secondary);
    cursor: pointer;
    font-size: var(--text-sm);
    padding: 0.25rem;
    border-radius: var(--radius-sm);
    line-height: 1;
    transition: color 0.15s, background 0.15s;
  }
  .tx-delete:hover {
    color: var(--color-negative);
    background: #fef2f2;
  }
  .tx-edit {
    background: none;
    border: none;
    color: var(--color-text-secondary);
    cursor: pointer;
    font-size: var(--text-sm);
    padding: 0.25rem;
    border-radius: var(--radius-sm);
    line-height: 1;
    transition: color 0.15s, background 0.15s;
  }
  .tx-edit:hover {
    color: var(--color-primary);
    background: var(--blue-50);
  }
  .tx-info-clickable {
    cursor: pointer;
    border-radius: var(--radius-sm);
    padding: 0.125rem 0;
    transition: background 0.15s;
  }
  .tx-info-clickable:hover {
    background: var(--gray-50);
  }
  :global(.tx-expanded) {
    box-shadow: 0 0 0 1px var(--color-primary);
  }
  .tx-description {
    margin-top: var(--space-sm);
    padding-top: var(--space-sm);
    border-top: 1px solid var(--color-border);
    font-size: var(--text-sm);
    color: var(--color-text-secondary);
    line-height: 1.5;
  }

  .empty-state {
    text-align: center;
    font-size: var(--text-sm);
  }
  .empty-state a {
    color: var(--color-primary);
  }

  :global(.summary-card), :global(.year-compact), :global(.year-table-section) {
    margin-bottom: var(--space-md);
  }

  .summary-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: var(--space-md);
  }
  .summary-item {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
  .summary-label {
    font-size: var(--text-xs);
    font-weight: 500;
    color: var(--color-text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .summary-value {
    font-family: var(--font-mono);
    font-weight: 700;
    font-size: var(--text-base);
  }

  .year-title {
    margin-bottom: var(--space-sm);
    font-size: var(--text-base);
  }

  .accordion-toggle {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    background: none;
    border: none;
    font-size: var(--text-sm);
    font-weight: 600;
    color: var(--color-text);
    cursor: pointer;
    padding: 0;
    font-family: inherit;
  }
  .accordion-arrow {
    font-size: var(--text-xs);
    color: var(--color-text-secondary);
  }
  .accordion-content {
    margin-top: var(--space-md);
  }

  @media (max-width: 640px) {
    .summary-grid {
      grid-template-columns: 1fr;
      gap: var(--space-sm);
    }
    .summary-item {
      flex-direction: row;
      justify-content: space-between;
      align-items: center;
    }
    .month-title {
      min-width: 10rem;
      font-size: var(--text-lg);
    }
  }
</style>