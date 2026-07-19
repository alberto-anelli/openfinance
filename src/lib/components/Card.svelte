<script lang="ts">
  let { variant = 'default', padding = 'md', class: className = '', children }: {
    variant?: 'default' | 'income' | 'expense' | 'summary';
    padding?: 'sm' | 'md' | 'lg';
    class?: string;
    children?: import('svelte').Snippet;
  } = $props();
</script>

<div class="card card-{variant} card-pad-{padding} {className}">
  {@render children?.()}
</div>

<style>
  .card {
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-sm);
  }
  .card-income {
    border-left: 4px solid var(--color-income);
  }
  .card-expense {
    border-left: 4px solid var(--color-expense);
  }
  .card-summary {
    background: var(--gray-50);
    border: 1px solid var(--color-border);
  }
  .card-pad-sm { padding: var(--space-sm); }
  .card-pad-md { padding: var(--space-md); }
  .card-pad-lg { padding: var(--space-lg); }
</style>