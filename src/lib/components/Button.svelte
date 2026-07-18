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
  {@render children?.()}
</button>

<style>
  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-sm);
    padding: 0.5rem 1rem;
    font-size: var(--text-sm);
    font-weight: 500;
    line-height: 1.25;
    border: 1px solid transparent;
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: background 0.15s, border-color 0.15s, box-shadow 0.15s;
    white-space: nowrap;
    font-family: inherit;
  }
  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .btn-primary {
    background: var(--color-primary);
    color: #fff;
  }
  .btn-primary:hover:not(:disabled) {
    background: var(--color-primary-hover);
  }
  .btn-secondary {
    background: var(--color-surface);
    color: var(--color-text);
    border-color: var(--color-border);
  }
  .btn-secondary:hover:not(:disabled) {
    background: var(--gray-50);
  }
  .btn-danger {
    background: var(--color-negative);
    color: #fff;
  }
  .btn-danger:hover:not(:disabled) {
    background: #b91c1c;
  }
  .btn-ghost {
    background: transparent;
    color: var(--color-text-secondary);
  }
  .btn-ghost:hover:not(:disabled) {
    background: var(--gray-100);
    color: var(--color-text);
  }
</style>