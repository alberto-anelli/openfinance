<script lang="ts">
  let { message = 'Nessun dato', subtext = '' }: { message?: string; subtext?: string } = $props();
</script>

<div class="empty-state">
  <svg class="empty-illustration" viewBox="0 0 120 80" fill="none" xmlns="http://www.w3.org/2000/svg">
    <!-- Chart grid lines -->
    <line class="grid-line" x1="20" y1="60" x2="100" y2="60" stroke-width="0.5" />
    <line class="grid-line" x1="20" y1="45" x2="100" y2="45" stroke-width="0.5" />
    <line class="grid-line" x1="20" y1="30" x2="100" y2="30" stroke-width="0.5" />

    <!-- Bar 1 (income) -->
    <rect class="bar-income" x="28" y="28" width="10" height="32" rx="1.5" opacity="0.3" />
    <!-- Bar 2 (expense) -->
    <rect class="bar-expense" x="44" y="40" width="10" height="20" rx="1.5" opacity="0.3" />
    <!-- Bar 3 (income) -->
    <rect class="bar-income" x="60" y="22" width="10" height="38" rx="1.5" opacity="0.3" />
    <!-- Bar 4 (expense) -->
    <rect class="bar-expense" x="76" y="35" width="10" height="25" rx="1.5" opacity="0.3" />

    <!-- Dashed line indicating "no data yet" -->
    <line class="dash-line" x1="20" y1="50" x2="100" y2="50" stroke-dasharray="4 3" stroke-width="1.5" />

    <!-- Question mark -->
    <text class="q-mark" x="60" y="42" text-anchor="middle" font-size="16" font-weight="700" font-family="'JetBrains Mono',monospace">?</text>
  </svg>
  <span class="empty-message">{message}</span>
  {#if subtext}
    <span class="empty-subtext">{subtext}</span>
  {/if}
</div>

<style>
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-sm);
    padding: var(--space-xl) 0;
  }

  .empty-illustration {
    width: 120px;
    height: 80px;
    margin-bottom: var(--space-xs);
  }

  .grid-line {
    stroke: var(--color-border);
  }

  .bar-income {
    fill: var(--color-income, #3399ff);
  }

  .bar-expense {
    fill: var(--color-expense, #ff7700);
  }

  .dash-line {
    stroke: var(--color-text-dim);
  }

  .q-mark {
    fill: var(--color-text-dim);
  }

  .empty-message {
    font-size: var(--text-sm);
    font-weight: 600;
    color: var(--color-text-secondary);
    font-family: var(--font-body);
  }

  .empty-subtext {
    font-size: var(--text-xs);
    color: var(--color-text-dim);
    font-family: var(--font-body);
  }
</style>