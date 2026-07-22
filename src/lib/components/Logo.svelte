<script lang="ts">
  import { getBasePath } from '$lib/base';
  let { size = 'default' }: { size?: 'sm' | 'default' } = $props();
  let base = $derived(getBasePath());
</script>

<a href={base + '/app'} class="logo" data-size={size}>
  <svg class="logo-icon" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
    <!-- Background square -->
    <rect class="logo-bg" x="0.5" y="0.5" width="27" height="27" rx="4" />
    <!-- "B" letter -->
    <text class="logo-letter" x="4" y="20" font-size="18" font-weight="700" font-family="'JetBrains Mono',monospace">B</text>
    <!-- Chart bar 1: income (blue, going up) -->
    <rect class="logo-bar-income" x="19" y="12" width="2.5" height="10" rx="0.8" />
    <!-- Chart bar 2: expense (orange, going down — shorter) -->
    <rect class="logo-bar-expense" x="23" y="16" width="2.5" height="6" rx="0.8" />
  </svg>
  <span class="logo-text">Bilancio</span>
</a>

<style>
  .logo {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    text-decoration: none;
    font-family: var(--font-body);
    transition: opacity 0.1s;
  }
  .logo:hover {
    opacity: 0.8;
    text-decoration: none;
  }

  .logo-icon {
    width: 28px;
    height: 28px;
    flex-shrink: 0;
  }

  [data-size="sm"] .logo-icon {
    width: 22px;
    height: 22px;
  }

  .logo-bg {
    fill: var(--color-surface);
    stroke: var(--color-border);
    stroke-width: 1;
  }

  .logo-letter {
    fill: var(--color-primary);
  }

  .logo-bar-income {
    fill: var(--color-income, #3399ff);
  }

  .logo-bar-expense {
    fill: var(--color-expense, #ff7700);
  }

  .logo-text {
    font-size: var(--text-lg);
    font-weight: 700;
    color: var(--color-text);
    letter-spacing: 0;
  }
</style>