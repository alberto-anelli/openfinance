<script lang="ts">
  import type { YearSummary } from '$lib/api/client';
  import { formatCents } from '$lib/format';

  let { summary }: { summary: YearSummary } = $props();

  const monthNames = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];
</script>

<div class="summary-table-wrapper">
  <table class="summary-table">
    <thead>
      <tr>
        <th>Mese</th>
        <th class="num">Entrate</th>
        <th class="num">Uscite</th>
        <th class="num">Gap</th>
      </tr>
    </thead>
    <tbody>
      {#each summary.months as month, i}
        <tr class={month ? '' : 'empty'}>
          <td class="month-name">{monthNames[i]}</td>
          {#if month}
            <td class="num text-income">{formatCents(month.totalIncome)}</td>
            <td class="num text-expense">{formatCents(month.totalExpenses)}</td>
            <td class="num {month.difference >= 0 ? 'text-positive' : 'text-negative'}">
              {formatCents(month.difference)}
            </td>
          {:else}
            <td class="num text-muted">—</td>
            <td class="num text-muted">—</td>
            <td class="num text-muted">—</td>
          {/if}
        </tr>
      {/each}
    </tbody>
    <tfoot>
      <tr>
        <th>Totale</th>
        <th class="num text-income">{formatCents(summary.totalIncome)}</th>
        <th class="num text-expense">{formatCents(summary.totalExpenses)}</th>
        <th class="num {summary.totalDifference >= 0 ? 'text-positive' : 'text-negative'}">
          {formatCents(summary.totalDifference)}
        </th>
      </tr>
    </tfoot>
  </table>
</div>

<style>
  .summary-table-wrapper {
    overflow-x: auto;
  }
  .summary-table {
    width: 100%;
    border-collapse: collapse;
    font-size: var(--text-xs);
    font-family: var(--font-mono);
  }
  th, td {
    padding: 0.35rem 0.6rem;
    text-align: left;
    border-bottom: 1px solid var(--color-border);
  }
  th {
    font-weight: 600;
    color: var(--color-text-secondary);
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .num {
    text-align: right;
    font-family: var(--font-mono);
    white-space: nowrap;
  }
  .month-name {
    font-weight: 500;
  }
  tfoot th {
    border-top: 2px solid var(--color-text);
    color: var(--color-text);
    font-size: var(--text-xs);
    text-transform: none;
    letter-spacing: 0;
  }
  tr.empty td {
    color: var(--color-text-dim);
  }
</style>