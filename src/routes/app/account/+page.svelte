<script lang="ts">
  import { onMount } from 'svelte';
  import { api, type Account, type AccountBalanceLog } from '$lib/api/client';
  import { formatCents, parseInput, formatInput } from '$lib/format';
  import Button from '$lib/components/Button.svelte';
  import AmountInput from '$lib/components/AmountInput.svelte';

  // ── State ──────────────────────────────────────────────────────────────
  let accounts = $state<Account[]>([]);
  let selectedAccountId = $state<string | null>(null);
  let balances = $state<AccountBalanceLog[]>([]);
  let loading = $state(true);
  let error = $state('');

  // Latest balance per account id
  let latestBalancesMap = $state<Map<string, number>>(new Map());

  // Wealth history data
  let wealthHistory = $state<{ date: string; netWealth: number; accountCount: number }[]>([]);
  let wealthHistoryLoading = $state(false);

  // Reconciliation data for selected account
  let reconciliation = $state<{
    deltas: { fromDate: string; fromBalance: number; toDate: string; toBalance: number; delta: number; daysBetween: number }[];
    balanceLogCount: number;
    latestBalance: number | null;
    firstBalance: number | null;
    totalChange: number | null;
  } | null>(null);
  let reconciliationLoading = $state(false);

  // Modal state
  let showAccountModal = $state(false);
  let editingAccount = $state<Account | null>(null);
  let showBalanceModal = $state(false);
  let editingBalance = $state<AccountBalanceLog | null>(null);

  // Form state
  let formName = $state('');
  let formType = $state('');
  let formColor = $state('#6366f1');
  let formBalance = $state(0);
  let formDate = $state('');
  let formNote = $state('');
  let formSaving = $state(false);
  let accountTypeSuggestions = $state<string[]>([]);

  // ── Derived ────────────────────────────────────────────────────────────
  let selectedAccount = $derived(
    accounts.find(a => a.id === selectedAccountId) ?? null
  );

  let currentBalance = $derived.by(() => {
    if (balances.length === 0) return null;
    return balances.reduce((latest, b) => b.date > latest.date ? b : latest);
  });

  // ── Wealth statistics ──────────────────────────────────────────────────
  interface TypeWealth {
    type: string;
    label: string;
    icon: string;
    total: number;
    count: number;
    pct: number;
  }

  const accountTypeLabels: Record<string, string> = {
    bank: 'Conto Corrente',
    credit_card: 'Carta di Credito',
    debit_card: 'Carta di Debito',
    savings: 'Conto Risparmio',
    cash: 'Contanti',
    other: 'Altro',
  };

  const accountTypeIcons: Record<string, string> = {
    bank: '🏦',
    credit_card: '💳',
    debit_card: '💳',
    savings: '🐷',
    cash: '💵',
    other: '📦',
  };

  const accountTypeColors: Record<string, string> = {
    bank: '#2563eb',
    credit_card: '#f97316',
    debit_card: '#14b8a6',
    savings: '#16a34a',
    cash: '#8b5cf6',
    other: '#6b7280',
  };

  function typeLabel(t: string): string {
    return accountTypeLabels[t] ?? t;
  }

  function typeIcon(t: string): string {
    return accountTypeIcons[t] ?? '📁';
  }

  function typeColor(t: string): string {
    return accountTypeColors[t] ?? '#6b7280';
  }

  let totalNetWorth = $derived(
    Array.from(latestBalancesMap.values()).reduce((sum, b) => sum + b, 0)
  );

  let wealthByType = $derived.by(() => {
    const byType = new Map<string, { total: number; count: number }>();
    for (const acc of accounts) {
      const bal = latestBalancesMap.get(acc.id) ?? 0;
      const entry = byType.get(acc.type) ?? { total: 0, count: 0 };
      entry.total += bal;
      entry.count++;
      byType.set(acc.type, entry);
    }

    const result: TypeWealth[] = [];
    for (const [type, data] of byType) {
      result.push({
        type,
        label: typeLabel(type),
        icon: typeIcon(type),
        total: data.total,
        count: data.count,
        pct: totalNetWorth !== 0 ? data.total / totalNetWorth : 0,
      });
    }
    result.sort((a, b) => b.total - a.total);
    return result;
  });

  let maxTypeWealth = $derived(
    wealthByType.length > 0 ? Math.max(...wealthByType.map(w => Math.abs(w.total))) : 1
  );

  // ── Wealth history derived ─────────────────────────────────────────────
  let wealthHistorySorted = $derived(
    [...wealthHistory].sort((a, b) => a.date.localeCompare(b.date))
  );

  let wealthMin = $derived(
    wealthHistorySorted.length > 0 ? Math.min(...wealthHistorySorted.map(w => w.netWealth)) : 0
  );
  let wealthMax = $derived(
    wealthHistorySorted.length > 0 ? Math.max(...wealthHistorySorted.map(w => w.netWealth)) : 1
  );
  let wealthRange = $derived(Math.max(1, wealthMax - wealthMin));

  // Monthly deltas from balance logs — FIXED: cross-month deltas included
  interface MonthDelta {
    year: number;
    month: number;
    startBalance: number | null;
    endBalance: number | null;
    delta: number | null;
  }

  let monthlyDeltas = $derived.by(() => {
    if (balances.length < 2) return [];
    const sorted = [...balances].sort((a, b) => a.date.localeCompare(b.date));
    const deltas: MonthDelta[] = [];
    const months = new Set<string>();

    for (const b of sorted) {
      const d = new Date(b.date + 'T00:00:00');
      months.add(`${d.getFullYear()}-${d.getMonth() + 1}`);
    }

    const sortedMonths = Array.from(months).sort();
    for (const ym of sortedMonths) {
      const [year, month] = ym.split('-').map(Number);
      const monthLogs = sorted.filter(b => {
        const d = new Date(b.date + 'T00:00:00');
        return d.getFullYear() === year && d.getMonth() + 1 === month;
      });
      if (monthLogs.length === 0) continue;

      const startBalance = monthLogs[0].balance;
      const endBalance = monthLogs[monthLogs.length - 1].balance;
      // The delta is simply end - start (net change during the month)
      const delta = endBalance - startBalance;

      deltas.push({
        year,
        month,
        startBalance,
        endBalance,
        delta,
      });
    }

    return deltas;
  });

  let maxDelta = $derived(
    monthlyDeltas.length > 0
      ? Math.max(1, ...monthlyDeltas.map(d => Math.abs(d.delta ?? 0)))
      : 1
  );

  // ── Reconciliation derived ─────────────────────────────────────────────
  let reconAvgDelta = $derived.by(() => {
    if (!reconciliation || reconciliation.deltas.length === 0) return null;
    const total = reconciliation.deltas.reduce((s, d) => s + d.delta, 0);
    return total / reconciliation.deltas.length;
  });

  let reconAbsAvgDelta = $derived.by(() => {
    if (!reconciliation || reconciliation.deltas.length === 0) return null;
    const total = reconciliation.deltas.reduce((s, d) => s + Math.abs(d.delta), 0);
    return total / reconciliation.deltas.length;
  });

  let reconMaxDelta = $derived.by(() => {
    if (!reconciliation || reconciliation.deltas.length === 0) return null;
    return Math.max(...reconciliation.deltas.map(d => Math.abs(d.delta)));
  });

  let reconVolatility = $derived.by(() => {
    if (!reconciliation || reconciliation.deltas.length < 2) return null;
    const mean = reconAvgDelta ?? 0;
    const sqDiffs = reconciliation.deltas.map(d => (d.delta - mean) ** 2);
    return Math.sqrt(sqDiffs.reduce((s, v) => s + v, 0) / sqDiffs.length);
  });

  // ── Data loading ───────────────────────────────────────────────────────
  async function loadAccounts() {
    loading = true;
    error = '';
    try {
      accounts = await api.listAccounts();
      // Load latest balance for every account
      const latestMap = new Map<string, number>();
      await Promise.all(accounts.map(async (acc) => {
        try {
          const accBalances = await api.listBalances(acc.id);
          if (accBalances.length > 0) {
            const latest = accBalances.reduce((a, b) => a.date > b.date ? a : b);
            latestMap.set(acc.id, latest.balance);
          }
        } catch { /* skip */ }
      }));
      latestBalancesMap = latestMap;

      if (selectedAccountId && accounts.some(a => a.id === selectedAccountId)) {
        await loadBalances(selectedAccountId);
      } else {
        selectedAccountId = accounts.length > 0 ? accounts[0].id : null;
        if (selectedAccountId) await loadBalances(selectedAccountId);
        else balances = [];
      }

      // Load wealth history
      loadWealthHistory();
    } catch (err) {
      error = err instanceof Error ? err.message : 'Errore nel caricamento';
    } finally {
      loading = false;
    }
  }

  async function loadBalances(accountId: string) {
    try {
      balances = await api.listBalances(accountId);
      // Also load reconciliation for this account
      loadReconciliation(accountId);
    } catch {
      balances = [];
    }
  }

  async function loadWealthHistory() {
    wealthHistoryLoading = true;
    try {
      wealthHistory = await api.wealthHistory();
    } catch {
      // non-critical
    } finally {
      wealthHistoryLoading = false;
    }
  }

  async function loadReconciliation(accountId: string) {
    reconciliationLoading = true;
    try {
      const result = await api.accountReconciliation(accountId);
      reconciliation = result;
    } catch {
      reconciliation = null;
    } finally {
      reconciliationLoading = false;
    }
  }

  onMount(loadAccounts);

  // Load account type suggestions
  $effect(() => {
    api.accountTypes().then(types => {
      accountTypeSuggestions = types;
    }).catch(() => { /* ignore */ });
  });

  // ── Account CRUD ───────────────────────────────────────────────────────
  function openAddAccount() {
    editingAccount = null;
    formName = '';
    formType = '';
    formColor = '#6366f1';
    showAccountModal = true;
  }

  function openEditAccount(acc: Account) {
    editingAccount = acc;
    formName = acc.name;
    formType = acc.type;
    formColor = acc.color;
    showAccountModal = true;
  }

  async function saveAccount() {
    if (!formName.trim()) return;
    formSaving = true;
    try {
      if (editingAccount) {
        await api.updateAccount(editingAccount.id, {
          name: formName.trim(),
          type: formType,
          color: formColor,
        });
      } else {
        await api.createAccount({
          name: formName.trim(),
          type: formType,
          color: formColor,
        });
      }
      showAccountModal = false;
      await loadAccounts();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Errore');
    } finally {
      formSaving = false;
    }
  }

  async function deleteAccount(acc: Account) {
    if (!confirm(`Eliminare "${acc.name}"? Tutti i saldi associati verranno rimossi.`)) return;
    try {
      await api.deleteAccount(acc.id);
      if (selectedAccountId === acc.id) {
        selectedAccountId = null;
        balances = [];
      }
      await loadAccounts();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Errore');
    }
  }

  function selectAccount(id: string) {
    selectedAccountId = id;
    loadBalances(id);
  }

  // ── Balance CRUD ───────────────────────────────────────────────────────
  function openAddBalance() {
    if (!selectedAccount) return;
    editingBalance = null;
    formBalance = 0;
    formDate = new Date().toISOString().split('T')[0];
    formNote = '';
    showBalanceModal = true;
  }

  function openEditBalance(log: AccountBalanceLog) {
    editingBalance = log;
    formBalance = log.balance;
    formDate = log.date;
    formNote = log.note ?? '';
    showBalanceModal = true;
  }

  async function saveBalance() {
    if (!formDate || !selectedAccount) return;

    formSaving = true;
    try {
      if (editingBalance) {
        await api.updateBalance(editingBalance.id, {
          balance: formBalance,
          date: formDate,
          note: formNote.trim() || undefined,
        });
      } else {
        await api.createBalance(selectedAccount.id, {
          balance: formBalance,
          date: formDate,
          note: formNote.trim() || undefined,
        });
      }
      showBalanceModal = false;
      await loadBalances(selectedAccount.id);
      // Refresh latest balances map
      const updatedBalances = await api.listBalances(selectedAccount.id);
      if (updatedBalances.length > 0) {
        const latest = updatedBalances.reduce((a, b) => a.date > b.date ? a : b);
        const newMap = new Map(latestBalancesMap);
        newMap.set(selectedAccount.id, latest.balance);
        latestBalancesMap = newMap;
      }
      await loadReconciliation(selectedAccount.id);
      await loadWealthHistory();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Errore');
    } finally {
      formSaving = false;
    }
  }

  async function deleteBalance(id: string) {
    if (!confirm('Eliminare questa registrazione di saldo?')) return;
    try {
      await api.deleteBalance(id);
      if (selectedAccountId) {
        await loadBalances(selectedAccountId);
        // Refresh latest balances map
        const updatedBalances = await api.listBalances(selectedAccountId);
        const newMap = new Map(latestBalancesMap);
        if (updatedBalances.length > 0) {
          const latest = updatedBalances.reduce((a, b) => a.date > b.date ? a : b);
          newMap.set(selectedAccountId, latest.balance);
        } else {
          newMap.delete(selectedAccountId);
        }
        latestBalancesMap = newMap;
        await loadReconciliation(selectedAccountId);
        await loadWealthHistory();
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Errore');
    }
  }

  // ── Chart helpers ──────────────────────────────────────────────────────
  const CHART_W = 600;
  const CHART_H = 200;
  const CHART_PAD = 8;

  // Wealth history chart dimensions
  const WH_CHART_W = 600;
  const WH_CHART_H = 150;
  const WH_CHART_PAD = 6;

  function balanceLinePath(): string | null {
    if (sortedBalances.length < 2) return null;
    const stepX = balStepX;
    let d = '';
    for (let i = 0; i < sortedBalances.length; i++) {
      const x = CHART_PAD + i * stepX;
      const y = CHART_PAD + ((maxBal - sortedBalances[i].balance) / balRange) * (CHART_H - CHART_PAD * 2);
      d += i === 0 ? `M${x},${y}` : `L${x},${y}`;
    }
    return d;
  }

  function balanceAreaPath(): string | null {
    if (sortedBalances.length < 2) return null;
    const stepX = balStepX;
    let d = '';
    for (let i = 0; i < sortedBalances.length; i++) {
      const x = CHART_PAD + i * stepX;
      const y = CHART_PAD + ((maxBal - sortedBalances[i].balance) / balRange) * (CHART_H - CHART_PAD * 2);
      d += i === 0 ? `M${x},${y}` : `L${x},${y}`;
    }
    const lastX = CHART_PAD + (sortedBalances.length - 1) * stepX;
    d += `L${lastX},${CHART_H - CHART_PAD}L${CHART_PAD},${CHART_H - CHART_PAD}Z`;
    return d;
  }

  const monthNamesShort = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];

  let sortedBalances = $derived(
    [...balances].sort((a, b) => a.date.localeCompare(b.date))
  );
  let minBal = $derived(sortedBalances.length > 0 ? Math.min(...sortedBalances.map(b => b.balance)) : 0);
  let maxBal = $derived(sortedBalances.length > 0 ? Math.max(...sortedBalances.map(b => b.balance)) : 1);
  let balRange = $derived(Math.max(1, maxBal - minBal));
  let balStepX = $derived((CHART_W - CHART_PAD * 2) / Math.max(1, sortedBalances.length - 1));

  let whStepXAcc = $derived((WH_CHART_W - WH_CHART_PAD * 2) / Math.max(1, wealthHistorySorted.length - 1));

  function formatEuroShort(c: number): string {
    const eur = c / 100;
    if (Math.abs(eur) >= 1000) return (eur / 1000).toFixed(1) + 'k';
    return eur.toFixed(0) + '€';
  }

  // Wealth history SVG path helpers
  function whAreaPathAcc(): string {
    if (wealthHistorySorted.length < 2) return '';
    const stepX = (WH_CHART_W - WH_CHART_PAD * 2) / Math.max(1, wealthHistorySorted.length - 1);
    let d = `M${WH_CHART_PAD},${WH_CHART_H - WH_CHART_PAD}`;
    for (let i = 0; i < wealthHistorySorted.length; i++) {
      const x = WH_CHART_PAD + i * stepX;
      const y = WH_CHART_PAD + ((wealthMax - wealthHistorySorted[i].netWealth) / wealthRange) * (WH_CHART_H - WH_CHART_PAD * 2);
      d += `L${x},${y}`;
    }
    const lastX = WH_CHART_PAD + (wealthHistorySorted.length - 1) * stepX;
    d += `L${lastX},${WH_CHART_H - WH_CHART_PAD}Z`;
    return d;
  }

  function whLinePathAcc(): string {
    if (wealthHistorySorted.length < 2) return '';
    const stepX = (WH_CHART_W - WH_CHART_PAD * 2) / Math.max(1, wealthHistorySorted.length - 1);
    let d = '';
    for (let i = 0; i < wealthHistorySorted.length; i++) {
      const x = WH_CHART_PAD + i * stepX;
      const y = WH_CHART_PAD + ((wealthMax - wealthHistorySorted[i].netWealth) / wealthRange) * (WH_CHART_H - WH_CHART_PAD * 2);
      d += i === 0 ? `M${x},${y}` : `L${x},${y}`;
    }
    return d;
  }

  </script>

<svelte:head>
  <title>Conti — Bilancio</title>
</svelte:head>

<!-- ── Header ──────────────────────────────────────────────────────────── -->
<div class="page-header">
  <h2 class="page-title">Conti</h2>
  <Button onclick={openAddAccount}>+ Nuovo Conto</Button>
</div>

<!-- ── Loading / Error ─────────────────────────────────────────────────── -->
{#if loading}
  <div class="loading"><div class="spinner"></div><p>Caricamento...</p></div>
{:else if error}
  <div class="error-card">
    <p class="text-expense">{error}</p>
    <Button onclick={loadAccounts}>Riprova</Button>
  </div>
{:else if accounts.length === 0}
  <div class="empty-state">
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none" class="empty-icon">
      <rect x="8" y="16" width="32" height="24" rx="3" stroke="var(--slate-300)" stroke-width="2" fill="none" />
      <path d="M8 22h32" stroke="var(--slate-300)" stroke-width="2" />
      <circle cx="32" cy="30" r="4" fill="var(--slate-200)" />
    </svg>
    <p class="empty-text">Nessun conto</p>
    <p class="empty-sub text-muted">Aggiungi un conto corrente, carta o salvadanaio</p>
    <Button onclick={openAddAccount}>Crea il primo conto</Button>
  </div>
{:else}

  <!-- ════════════════════════════════════════════════════════════════════ -->
  <!-- WEALTH OVERVIEW — aggregate statistics across all accounts          -->
  <!-- ════════════════════════════════════════════════════════════════════ -->
  <div class="wealth-section">
    <div class="wealth-hero">
      <span class="wealth-hero-label">Patrimonio Netto</span>
      <span class="wealth-hero-amount {totalNetWorth >= 0 ? 'text-positive' : 'text-negative'}">
        {formatCents(totalNetWorth)}
      </span>
      <span class="wealth-hero-sub text-muted">{accounts.length} conti</span>
    </div>

    {#if wealthByType.length > 0}
      <div class="wealth-breakdown">
        <h3 class="wealth-title">Suddivisione per Tipo</h3>
        <div class="wealth-stacked-bar">
          {#each wealthByType as w}
            <div
              class="wealth-bar-segment"
              style="width: {Math.abs(w.pct) * 100}%; background: {typeColor(w.type)}"
              title="{w.label}: {formatCents(w.total)}"
            ></div>
          {/each}
        </div>
        <div class="wealth-type-list">
          {#each wealthByType as w}
            <div class="wealth-type-row">
              <span class="wealth-type-icon">{w.icon}</span>
              <span class="wealth-type-label">{w.label}</span>
              <span class="wealth-type-count">{w.count}</span>
              <div class="wealth-type-bar-track">
                <div
                  class="wealth-type-bar-fill"
                  style="width: {(w.total / maxTypeWealth) * 100}%; background: {typeColor(w.type)}"
                ></div>
              </div>
              <span class="wealth-type-amount">{formatCents(w.total)}</span>
              <span class="wealth-type-pct">{(Math.abs(w.pct) * 100).toFixed(1)}%</span>
            </div>
          {/each}
        </div>
      </div>
    {/if}

    {#if wealthHistorySorted.length >= 2}
      <div class="wealth-chart-section">
        <h3 class="wealth-title">Evoluzione Patrimonio Netto</h3>
        <svg viewBox="0 0 {WH_CHART_W} {WH_CHART_H + 20}" class="line-chart">
          <defs>
            <linearGradient id="whAreaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="var(--color-primary)40" />
              <stop offset="100%" stop-color="var(--color-primary)05" />
            </linearGradient>
          </defs>
          <!-- Area -->
          <path d={whAreaPathAcc()} fill="url(#whAreaGrad)" />
          <!-- Line -->
          <path d={whLinePathAcc()} fill="none" stroke="var(--color-primary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
          <!-- Dots -->
          {#each wealthHistorySorted as w, i}
            {@const x = WH_CHART_PAD + i * whStepXAcc}
            {@const y = WH_CHART_PAD + ((wealthMax - w.netWealth) / wealthRange) * (WH_CHART_H - WH_CHART_PAD * 2)}
            <circle cx={x} cy={y} r="3" fill="var(--color-primary)" stroke="#fff" stroke-width="1.5">
              <title>{new Date(w.date + 'T00:00:00').toLocaleDateString('it-IT')}: {formatCents(w.netWealth)}</title>
            </circle>
          {/each}
        </svg>
      </div>
    {/if}
  </div>

  <!-- ── Account list ──────────────────────────────────────────────────── -->
  <div class="accounts-grid">
    {#each accounts as acc}
      <div
        class="account-card"
        class:account-card-selected={selectedAccountId === acc.id}
        onclick={() => selectAccount(acc.id)}
        onkeydown={(e) => { if (e.key === 'Enter') selectAccount(acc.id); }}
        role="button"
        tabindex="0"
        style="--accent-color: {acc.color}"
      >
        <div class="acct-top">
          <span class="acct-icon">{typeIcon(acc.type)}</span>
          <span class="acct-type-badge">{typeLabel(acc.type)}</span>
        </div>
        <span class="acct-name">{acc.name}</span>
        <span class="acct-balance">
          {#if latestBalancesMap.has(acc.id)}
            <span class="acct-balance-amount">{formatCents(latestBalancesMap.get(acc.id)!)}</span>
          {:else}
            <span class="acct-balance-none text-muted">—</span>
          {/if}
        </span>
        <div class="acct-actions">
          <span class="acct-btn" role="button" tabindex="0" onclick={(e) => { e.stopPropagation(); openEditAccount(acc); }} onkeydown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); openEditAccount(acc); } }} aria-label="Modifica">✎</span>
          <span class="acct-btn acct-btn-del" role="button" tabindex="0" onclick={(e) => { e.stopPropagation(); deleteAccount(acc); }} onkeydown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); deleteAccount(acc); } }} aria-label="Elimina">✕</span>
        </div>
      </div>
    {/each}
  </div>

  <!-- ── Account detail panel ──────────────────────────────────────────── -->
  {#if selectedAccount}
    <div class="detail-panel">
      <div class="balance-hero" style="--accent-color: {selectedAccount.color}">
        <div class="balance-hero-left">
          <span class="balance-label">Saldo attuale</span>
          {#if currentBalance}
            <span class="balance-amount">{formatCents(currentBalance.balance)}</span>
            <span class="balance-date text-muted">al {new Date(currentBalance.date + 'T00:00:00').toLocaleDateString('it-IT')}</span>
          {:else}
            <span class="balance-amount text-muted">—</span>
            <span class="balance-date text-muted">Nessun saldo registrato</span>
          {/if}
        </div>
        <Button onclick={openAddBalance}>+ Registra Saldo</Button>
      </div>

      {#if sortedBalances.length >= 2}
        {@const path = balanceLinePath()}
        {@const areaPath = balanceAreaPath()}
        <div class="chart-card">
          <h3 class="section-title">Evoluzione del Saldo</h3>
          <svg viewBox="0 0 {CHART_W} {CHART_H + 20}" class="line-chart">
            <defs>
              <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="{selectedAccount.color}40" />
                <stop offset="100%" stop-color="{selectedAccount.color}05" />
              </linearGradient>
            </defs>
            {#if areaPath}
              <path d={areaPath} fill="url(#areaGrad)" />
            {/if}
            {#if path}
              <path d={path} fill="none" stroke={selectedAccount.color} stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
            {/if}
            {#each sortedBalances as b, i}
              {@const x = CHART_PAD + i * balStepX}
              {@const y = CHART_PAD + ((maxBal - b.balance) / balRange) * (CHART_H - CHART_PAD * 2)}
              <circle cx={x} cy={y} r="4" fill={selectedAccount.color} stroke="#fff" stroke-width="2">
                <title>{new Date(b.date + 'T00:00:00').toLocaleDateString('it-IT')}: {formatCents(b.balance)}</title>
              </circle>
            {/each}
          </svg>
        </div>
      {/if}

      {#if monthlyDeltas.length > 0}
        <div class="chart-card">
          <h3 class="section-title">Variazioni Mensili</h3>
          <div class="delta-chart-container">
            <svg viewBox="0 0 {Math.max(monthlyDeltas.length * 50, 200)} 180" class="delta-chart">
              {#each monthlyDeltas as d, i}
                {@const barW = 30}
                {@const barGap = Math.max(10, Math.min(30, 400 / monthlyDeltas.length - barW))}
                {@const x = i * (barW + barGap) + 10}
                {@const delta = d.delta ?? 0}
                {@const absH = Math.abs(delta) / maxDelta * 140}
                {@const h = Math.max(3, absH)}
                {@const isPositive = delta >= 0}
                {@const y = isPositive ? 160 - h : 160}
                <rect x={x} y={y} width={barW} height={h}
                  fill={isPositive ? 'var(--color-positive)' : 'var(--color-negative)'} rx="3">
                  <title>{monthNamesShort[d.month - 1]} {d.year}: {formatCents(delta)}</title>
                </rect>
                <text x={x + barW / 2} y={174} text-anchor="middle" class="delta-label">{monthNamesShort[d.month - 1]}</text>
              {/each}
            </svg>
          </div>
        </div>
      {/if}

      <!-- ── Reconciliation statistics ───────────────────────────────── -->
      {#if reconciliation && reconciliation.deltas.length > 0}
        <div class="chart-card">
          <h3 class="section-title">Analisi Saldo</h3>
          <div class="recon-stats-grid">
            <div class="recon-stat">
              <span class="recon-stat-label">Saldo Iniziale</span>
              <span class="recon-stat-value">{formatCents(reconciliation.firstBalance!)}</span>
            </div>
            <div class="recon-stat">
              <span class="recon-stat-label">Saldo Attuale</span>
              <span class="recon-stat-value">{formatCents(reconciliation.latestBalance!)}</span>
            </div>
            <div class="recon-stat">
              <span class="recon-stat-label">Variazione Totale</span>
              <span class="recon-stat-value {reconciliation.totalChange! >= 0 ? 'text-positive' : 'text-negative'}">
                {formatCents(reconciliation.totalChange!)}
              </span>
            </div>
            <div class="recon-stat">
              <span class="recon-stat-label">Registrazioni</span>
              <span class="recon-stat-value">{reconciliation.balanceLogCount}</span>
            </div>
            <div class="recon-stat">
              <span class="recon-stat-label">Delta Medio</span>
              <span class="recon-stat-value text-muted">{reconAvgDelta !== null ? formatCents(Math.round(reconAvgDelta)) : '—'}</span>
            </div>
            <div class="recon-stat">
              <span class="recon-stat-label">Delta Medio (ass.)</span>
              <span class="recon-stat-value text-muted">{reconAbsAvgDelta !== null ? formatCents(Math.round(reconAbsAvgDelta)) : '—'}</span>
            </div>
            <div class="recon-stat">
              <span class="recon-stat-label">Delta Massimo</span>
              <span class="recon-stat-value">{reconMaxDelta !== null ? formatCents(reconMaxDelta) : '—'}</span>
            </div>
            <div class="recon-stat">
              <span class="recon-stat-label">Volatilità</span>
              <span class="recon-stat-value text-muted">{reconVolatility !== null ? formatCents(Math.round(reconVolatility)) : '—'}</span>
            </div>
          </div>
          <div class="recon-delta-table">
            <div class="recon-delta-table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Da</th>
                    <th>A</th>
                    <th>Giorni</th>
                    <th>Variazione</th>
                    <th>Giornaliero</th>
                  </tr>
                </thead>
                <tbody>
                  {#each reconciliation.deltas as d}
                    <tr>
                      <td>{new Date(d.fromDate + 'T00:00:00').toLocaleDateString('it-IT')}</td>
                      <td>{new Date(d.toDate + 'T00:00:00').toLocaleDateString('it-IT')}</td>
                      <td class="recon-td-num">{d.daysBetween}</td>
                      <td class="recon-td-num {d.delta >= 0 ? 'text-positive' : 'text-negative'}">{formatCents(d.delta)}</td>
                      <td class="recon-td-num text-muted">
                        {d.daysBetween > 0 ? formatCents(Math.round(d.delta / d.daysBetween)) : '—'}
                      </td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      {/if}

      <div class="log-table-card">
        <div class="log-table-header">
          <h3 class="section-title">Registrazioni Saldo</h3>
          <span class="log-count">{balances.length} registrazioni</span>
        </div>
        {#if balances.length === 0}
          <p class="empty-log text-muted">Nessuna registrazione. Aggiungi il primo saldo.</p>
        {:else}
          <div class="log-table">
            <div class="log-row log-row-header">
              <span class="log-cell log-date">Data</span>
              <span class="log-cell log-bal">Saldo</span>
              <span class="log-cell log-note">Nota</span>
              <span class="log-cell log-actions"></span>
            </div>
            {#each balances as log (log.id)}
              <div class="log-row">
                <span class="log-cell log-date">{new Date(log.date + 'T00:00:00').toLocaleDateString('it-IT')}</span>
                <span class="log-cell log-bal log-bal-value">{formatCents(log.balance)}</span>
                <span class="log-cell log-note">{log.note ?? '—'}</span>
                <span class="log-cell log-actions">
                  <button class="log-btn" onclick={() => openEditBalance(log)} aria-label="Modifica">✎</button>
                  <button class="log-btn log-btn-del" onclick={() => deleteBalance(log.id)} aria-label="Elimina">✕</button>
                </span>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    </div>
  {/if}
{/if}

<!-- ── Account modal ──────────────────────────────────────────────────── -->
{#if showAccountModal}
  <div class="modal-overlay" onclick={() => showAccountModal = false} role="presentation">
    <div class="modal" onclick={(e) => e.stopPropagation()} role="dialog" tabindex="-1" onkeydown={(e) => { if (e.key === 'Escape') showAccountModal = false; }}>
      <h3 class="modal-title">{editingAccount ? 'Modifica Conto' : 'Nuovo Conto'}</h3>

      <label class="field">
        <span class="field-label">Nome</span>
        <input type="text" class="field-input" bind:value={formName} placeholder="es. Intesa Sanpaolo" />
      </label>

      <label class="field">
        <span class="field-label">Tipo</span>
        <input
          type="text"
          class="field-input"
          bind:value={formType}
          placeholder="es. Conto Corrente, Carta, Contanti..."
        />
        {#if accountTypeSuggestions.length > 0}
          <div class="tag-suggestions">
            {#each accountTypeSuggestions as t}
              <button
                type="button"
                class="tag"
                class:tag-active={formType === t}
                onclick={() => formType = t}
              >
                {t}
              </button>
            {/each}
          </div>
        {/if}
      </label>

      <label class="field">
        <span class="field-label">Colore</span>
        <div class="color-picker-row">
          {#each ['#2563eb', '#6366f1', '#8b5cf6', '#ec4899', '#f97316', '#16a34a', '#14b8a6', '#6b7280'] as c}
            <button
              class="color-swatch {formColor === c ? 'color-swatch-active' : ''}"
              style="background: {c}"
              onclick={() => formColor = c}
              aria-label={c}
            ></button>
          {/each}
        </div>
      </label>

      <div class="modal-actions">
        <Button variant="ghost" onclick={() => showAccountModal = false}>Annulla</Button>
        <Button onclick={saveAccount} disabled={!formName.trim() || formSaving}>
          {formSaving ? 'Salvataggio...' : editingAccount ? 'Salva' : 'Crea'}
        </Button>
      </div>
    </div>
  </div>
{/if}

<!-- ── Balance modal ──────────────────────────────────────────────────── -->
{#if showBalanceModal}
  <div class="modal-overlay" onclick={() => showBalanceModal = false} role="presentation">
    <div class="modal" onclick={(e) => e.stopPropagation()} role="dialog" tabindex="-1" onkeydown={(e) => { if (e.key === 'Escape') showBalanceModal = false; }}>
      <h3 class="modal-title">{editingBalance ? 'Modifica Saldo' : 'Registra Saldo'}</h3>

      <label class="field">
        <span class="field-label">Data</span>
        <input type="date" class="field-input" bind:value={formDate} />
      </label>

      <div class="field">
        <span class="field-label">Saldo</span>
        <AmountInput bind:value={formBalance} />
      </div>

      <label class="field">
        <span class="field-label">Nota (opzionale)</span>
        <input type="text" class="field-input" bind:value={formNote} placeholder="es. Saldo dopo stipendio" />
      </label>

      <div class="modal-actions">
        <Button variant="ghost" onclick={() => showBalanceModal = false}>Annulla</Button>
        <Button onclick={saveBalance} disabled={!formDate || formSaving}>
          {formSaving ? 'Salvataggio...' : editingBalance ? 'Salva' : 'Registra'}
        </Button>
      </div>
    </div>
  </div>
{/if}

<style>
  /* ── Page header ───────────────────────────────────────────────────────── */
  .page-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: var(--space-lg);
  }
  .page-title { font-size: var(--text-xl); }

  /* ── Loading / Error / Empty ────────────────────────────────────────────── */
  .loading { display: flex; flex-direction: column; align-items: center; gap: var(--space-md); padding: var(--space-2xl); color: var(--color-text-secondary); font-size: var(--text-sm); }
  .spinner { width: 28px; height: 28px; border: 3px solid var(--slate-200); border-top-color: var(--color-primary); border-radius: 50%; animation: spin 0.7s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .error-card { padding: var(--space-md); background: var(--color-surface); border: 1px solid var(--color-negative); border-radius: var(--radius-lg); display: flex; flex-direction: column; gap: var(--space-sm); }
  .empty-state { display: flex; flex-direction: column; align-items: center; gap: var(--space-sm); padding: var(--space-2xl); background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-lg); text-align: center; }
  .empty-icon { opacity: 0.4; margin-bottom: var(--space-sm); }
  .empty-text { font-size: var(--text-base); font-weight: 600; }
  .empty-sub { font-size: var(--text-sm); }

  /* ════════════════════════════════════════════════════════════════════════ */
  /* WEALTH OVERVIEW                                                         */
  /* ════════════════════════════════════════════════════════════════════════ */
  .wealth-section {
    padding: var(--space-lg);
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-sm);
    margin-bottom: var(--space-lg);
  }

  .wealth-hero {
    text-align: center;
    padding-bottom: var(--space-lg);
    border-bottom: 1px solid var(--slate-100);
    margin-bottom: var(--space-lg);
  }
  .wealth-hero-label {
    display: block;
    font-size: var(--text-xs);
    font-weight: 500;
    color: var(--color-text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-bottom: var(--space-xs);
  }
  .wealth-hero-amount {
    display: block;
    font-family: var(--font-mono);
    font-weight: 700;
    font-size: var(--text-2xl);
    margin-bottom: var(--space-xs);
  }
  .wealth-hero-sub {
    font-size: var(--text-sm);
  }

  .wealth-title {
    font-size: var(--text-sm);
    font-weight: 600;
    margin-bottom: var(--space-md);
  }

  .wealth-stacked-bar {
    display: flex;
    height: 8px;
    border-radius: var(--radius-full);
    overflow: hidden;
    margin-bottom: var(--space-md);
    background: var(--slate-100);
  }
  .wealth-bar-segment {
    height: 100%;
    transition: width 0.3s ease;
    min-width: 2px;
  }

  .wealth-type-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
  }
  .wealth-type-row {
    display: grid;
    grid-template-columns: 1.5rem 1fr 2rem 1fr 7rem 3.5rem;
    align-items: center;
    gap: var(--space-sm);
    font-size: var(--text-sm);
  }
  .wealth-type-icon { font-size: 1rem; text-align: center; }
  .wealth-type-label { font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .wealth-type-count {
    font-size: var(--text-xs);
    color: var(--color-text-secondary);
    text-align: center;
    font-family: var(--font-mono);
  }
  .wealth-type-bar-track { height: 16px; background: var(--slate-100); border-radius: var(--radius-sm); overflow: hidden; }
  .wealth-type-bar-fill { height: 100%; border-radius: var(--radius-sm); transition: width 0.3s ease; min-width: 3px; }
  .wealth-type-amount { font-family: var(--font-mono); font-weight: 600; text-align: right; font-size: var(--text-xs); }
  .wealth-type-pct { font-family: var(--font-mono); color: var(--color-text-secondary); text-align: right; font-size: var(--text-xs); }

  /* ── Account grid ──────────────────────────────────────────────────────── */
  .accounts-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: var(--space-md);
    margin-bottom: var(--space-lg);
  }

  .account-card {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    padding: var(--space-md);
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-left: 3px solid var(--accent-color);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-sm);
    cursor: pointer;
    transition: box-shadow 0.2s, border-color 0.2s;
    text-align: left;
    font-family: inherit;
    color: var(--color-text);
    width: 100%;
  }
  .account-card:hover { box-shadow: var(--shadow-md); }
  .account-card-selected { border-color: var(--accent-color); box-shadow: 0 0 0 2px var(--accent-color), var(--shadow-sm); }

  .acct-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--space-xs); }
  .acct-icon { font-size: 1.25rem; }
  .acct-type-badge { font-size: 10px; font-weight: 500; color: var(--color-text-secondary); padding: 0.125rem 0.375rem; background: var(--slate-100); border-radius: var(--radius-full); }
  .acct-name { font-weight: 600; font-size: var(--text-sm); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .acct-balance { margin-top: var(--space-xs); }
  .acct-balance-amount { font-family: var(--font-mono); font-weight: 700; font-size: var(--text-sm); }
  .acct-balance-none { font-family: var(--font-mono); font-size: var(--text-sm); }
  .acct-actions { display: flex; gap: 0.25rem; margin-top: var(--space-xs); opacity: 0; transition: opacity 0.15s; }
  .account-card:hover .acct-actions { opacity: 1; }
  .acct-btn { background: none; border: none; color: var(--color-text-secondary); cursor: pointer; font-size: 12px; padding: 0.125rem 0.25rem; border-radius: var(--radius-sm); transition: color 0.15s, background 0.15s; }
  .acct-btn:hover { color: var(--color-primary); background: var(--blue-50); }
  .acct-btn-del:hover { color: var(--color-negative); background: #fef2f2; }

  /* ── Detail panel ──────────────────────────────────────────────────────── */
  .detail-panel { display: flex; flex-direction: column; gap: var(--space-md); }

  .balance-hero { display: flex; align-items: center; justify-content: space-between; padding: var(--space-lg); background: var(--color-surface); border: 1px solid var(--color-border); border-left: 4px solid var(--accent-color); border-radius: var(--radius-lg); box-shadow: var(--shadow-sm); }
  .balance-hero-left { display: flex; flex-direction: column; gap: 0.125rem; }
  .balance-label { font-size: var(--text-xs); font-weight: 500; color: var(--color-text-secondary); text-transform: uppercase; letter-spacing: 0.05em; }
  .balance-amount { font-family: var(--font-mono); font-weight: 700; font-size: var(--text-2xl); }
  .balance-date { font-size: var(--text-xs); }

  /* ── Charts ────────────────────────────────────────────────────────────── */
  .chart-card { padding: var(--space-lg); background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-lg); box-shadow: var(--shadow-sm); }
  .section-title { font-size: var(--text-base); font-weight: 600; margin-bottom: var(--space-md); }
  .line-chart { width: 100%; height: 220px; display: block; }
  .delta-chart-container { width: 100%; overflow-x: auto; }
  .delta-chart { width: 100%; height: 180px; display: block; min-width: 200px; }
  .delta-label { font-size: 9px; fill: var(--color-text-secondary); font-family: var(--font-sans); }

  /* ── Balance log table ─────────────────────────────────────────────────── */
  .log-table-card { padding: var(--space-lg); background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-lg); box-shadow: var(--shadow-sm); }
  .log-table-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--space-md); }
  .log-count { font-size: var(--text-xs); color: var(--color-text-secondary); font-weight: 500; }
  .empty-log { font-size: var(--text-sm); text-align: center; padding: var(--space-md); }
  .log-table { display: flex; flex-direction: column; }
  .log-row { display: grid; grid-template-columns: 7rem 1fr 1fr 4rem; gap: var(--space-sm); padding: 0.5rem 0; border-bottom: 1px solid var(--slate-100); font-size: var(--text-sm); align-items: center; }
  .log-row:last-child { border-bottom: none; }
  .log-row-header { font-size: var(--text-xs); font-weight: 600; color: var(--color-text-secondary); text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 2px solid var(--slate-200); padding: 0.375rem 0; }
  .log-date { font-family: var(--font-mono); color: var(--color-text-secondary); }
  .log-bal { font-family: var(--font-mono); font-weight: 600; }
  .log-bal-value { font-size: var(--text-sm); }
  .log-note { color: var(--color-text-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .log-actions { display: flex; gap: 0.25rem; justify-content: flex-end; }
  .log-btn { background: none; border: none; color: var(--color-text-secondary); cursor: pointer; font-size: 12px; padding: 0.125rem 0.25rem; border-radius: var(--radius-sm); transition: color 0.15s, background 0.15s; }
  .log-btn:hover { color: var(--color-primary); background: var(--blue-50); }
  .log-btn-del:hover { color: var(--color-negative); background: #fef2f2; }

  /* ── Tag suggestions (tipo selector) ──────────────────────────────────────── */
  .tag-suggestions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-xs);
    margin-top: var(--space-xs);
  }
  .tag {
    padding: 0.25rem 0.65rem;
    font-size: var(--text-xs);
    font-weight: 500;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-full);
    background: var(--color-surface);
    color: var(--color-text-secondary);
    cursor: pointer;
    transition: all 0.15s;
    font-family: inherit;
    line-height: 1.4;
  }
  .tag:hover {
    border-color: var(--color-primary);
    color: var(--color-primary);
  }
  .tag-active {
    background: var(--color-primary);
    color: #fff;
    border-color: var(--color-primary);
  }
  .tag-active:hover {
    color: #fff;
  }

  /* ── Modal ──────────────────────────────────────────────────────────────── */
  .modal-overlay { position: fixed; inset: 0; background: rgba(0, 0, 0, 0.35); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; z-index: 200; padding: var(--space-md); }
  .modal { width: 100%; max-width: 420px; background: var(--color-surface); border-radius: var(--radius-xl); box-shadow: var(--shadow-xl); padding: var(--space-xl); display: flex; flex-direction: column; gap: var(--space-md); }
  .modal-title { font-size: var(--text-lg); font-weight: 600; }
  .field { display: flex; flex-direction: column; gap: 0.25rem; }
  .field-label { font-size: var(--text-xs); font-weight: 500; color: var(--color-text-secondary); text-transform: uppercase; letter-spacing: 0.05em; }
  .field-input { padding: 0.5rem 0.75rem; font-size: var(--text-sm); border: 1px solid var(--color-border); border-radius: var(--radius-md); background: var(--color-surface); color: var(--color-text); font-family: inherit; outline: none; transition: border-color 0.15s, box-shadow 0.15s; }
  .field-input:focus { border-color: var(--color-primary); box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15); }
  .color-picker-row { display: flex; gap: var(--space-xs); flex-wrap: wrap; }
  .color-swatch { width: 32px; height: 32px; border-radius: var(--radius-full); border: 2px solid transparent; cursor: pointer; transition: border-color 0.15s, transform 0.15s; }
  .color-swatch:hover { transform: scale(1.1); }
  .color-swatch-active { border-color: var(--color-text); }
  .modal-actions { display: flex; justify-content: flex-end; gap: var(--space-sm); margin-top: var(--space-sm); }

  /* ── Wealth chart section ──────────────────────────────────────────────────── */
  .wealth-chart-section {
    margin-top: var(--space-lg);
    padding-top: var(--space-lg);
    border-top: 1px solid var(--slate-100);
  }

  /* ── Reconciliation statistics ─────────────────────────────────────────────── */
  .recon-stats-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: var(--space-md);
    margin-bottom: var(--space-lg);
  }
  .recon-stat {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
  }
  .recon-stat-label {
    font-size: var(--text-xs);
    font-weight: 500;
    color: var(--color-text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .recon-stat-value {
    font-family: var(--font-mono);
    font-weight: 600;
    font-size: var(--text-sm);
  }
  .recon-delta-table {
    font-size: var(--text-sm);
  }
  .recon-delta-table-scroll {
    overflow-x: auto;
  }
  .recon-delta-table table {
    width: 100%;
    border-collapse: collapse;
  }
  .recon-delta-table th {
    text-align: left;
    font-size: var(--text-xs);
    font-weight: 600;
    color: var(--color-text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    padding: 0.375rem 0.5rem;
    border-bottom: 2px solid var(--slate-200);
  }
  .recon-delta-table td {
    padding: 0.375rem 0.5rem;
    border-bottom: 1px solid var(--slate-100);
    font-family: var(--font-mono);
  }
  .recon-td-num {
    text-align: right;
  }

  /* ── Responsive ─────────────────────────────────────────────────────────── */
  @media (max-width: 640px) {
    .accounts-grid { grid-template-columns: 1fr 1fr; }
    .balance-hero { flex-direction: column; align-items: flex-start; gap: var(--space-md); }
    .log-row { grid-template-columns: 6rem 1fr 3rem; }
    .log-note { display: none; }
    .wealth-type-row { grid-template-columns: 1.5rem 1fr 2rem 5rem; }
    .wealth-type-bar-track { display: none; }
    .wealth-type-pct { display: none; }
    .recon-stats-grid { grid-template-columns: repeat(2, 1fr); }
  }
</style>