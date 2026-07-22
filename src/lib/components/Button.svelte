<script lang="ts">
  let { variant = 'primary', type = 'button', disabled = false, onclick, children }: {
    variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
    type?: string;
    disabled?: boolean;
    onclick?: (e: MouseEvent) => void;
    children?: import('svelte').Snippet;
  } = $props();
</script>

<button
  {type}
  {disabled}
  onclick={onclick}
  class="btn btn-{variant}"
>
  {#if variant === 'primary'}
    <span class="btn-bracket">[</span>
  {/if}
  {@render children?.()}
  {#if variant === 'primary'}
    <span class="btn-bracket">]</span>
  {/if}
</button>

<style>
  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0;
    padding: 0.4rem 0.75rem;
    font-size: var(--text-xs);
    font-weight: 500;
    line-height: 1.25;
    font-family: var(--font-body);
    border: 1px solid transparent;
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: background 0.1s, color 0.1s, border-color 0.1s;
    white-space: nowrap;
    background: transparent;
    letter-spacing: 0;
  }
  .btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
  .btn-bracket {
    color: currentColor;
    opacity: 0.6;
    padding: 0 0.1rem;
  }
  .btn-primary {
    color: var(--color-primary);
    border-color: var(--color-primary);
    background: transparent;
  }
  .btn-primary:hover:not(:disabled) {
    background: var(--color-expense-bg);
  }
  .btn-secondary {
    color: var(--color-text-secondary);
    border-color: var(--color-border);
  }
  .btn-secondary:hover:not(:disabled) {
    border-color: var(--color-text-secondary);
    color: var(--color-text);
  }
  .btn-danger {
    color: var(--color-negative);
    border-color: var(--color-negative);
  }
  .btn-danger:hover:not(:disabled) {
    background: var(--color-expense-bg);
  }
  .btn-ghost {
    color: var(--color-text-secondary);
    border-color: transparent;
  }
  .btn-ghost:hover:not(:disabled) {
    color: var(--color-text);
  }
</style>