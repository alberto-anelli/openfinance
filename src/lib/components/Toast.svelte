<script lang="ts">
  let { message = '', type = 'success', visible = false, ondismiss }: {
    message?: string;
    type?: 'success' | 'error';
    visible?: boolean;
    ondismiss?: () => void;
  } = $props();

  let timer: ReturnType<typeof setTimeout> | null = null;

  $effect(() => {
    if (visible) {
      timer = setTimeout(() => {
        ondismiss?.();
      }, 3000);
      return () => {
        if (timer) clearTimeout(timer);
      };
    }
  });
</script>

{#if visible && message}
  <div class="toast toast-{type}" role="alert">
    <span class="toast-icon">{type === 'success' ? 'OK' : 'ER'}</span>
    <span class="toast-sep">|</span>
    <span class="toast-message">{message}</span>
    <button class="toast-close" onclick={() => ondismiss?.()}>x</button>
  </div>
{/if}

<style>
  .toast {
    position: fixed;
    bottom: 1.5rem;
    right: 1.5rem;
    display: flex;
    align-items: center;
    gap: var(--space-xs);
    padding: 0.5rem 0.75rem;
    font-family: var(--font-body);
    font-size: var(--text-xs);
    z-index: 1000;
    max-width: 24rem;
  }
  .toast-success {
    background: var(--color-surface);
    color: var(--color-positive);
    border: 1px solid var(--color-positive);
  }
  .toast-error {
    background: var(--color-surface);
    color: var(--color-negative);
    border: 1px solid var(--color-negative);
  }
  .toast-icon {
    font-weight: 700;
  }
  .toast-sep {
    opacity: 0.4;
  }
  .toast-message {
    flex: 1;
  }
  .toast-close {
    background: none;
    border: none;
    cursor: pointer;
    color: inherit;
    padding: 0 0.25rem;
    font-family: var(--font-body);
    font-size: var(--text-xs);
    opacity: 0.6;
    line-height: 1;
  }
  .toast-close:hover {
    opacity: 1;
  }

  @media (max-width: 640px) {
    .toast {
      left: 1rem;
      right: 1rem;
      bottom: 1rem;
      max-width: none;
    }
  }
</style>