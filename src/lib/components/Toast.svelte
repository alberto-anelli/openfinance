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
    <span class="toast-icon">{type === 'success' ? '✓' : '✕'}</span>
    <span class="toast-message">{message}</span>
    <button class="toast-close" onclick={() => ondismiss?.()}>×</button>
  </div>
{/if}

<style>
  .toast {
    position: fixed;
    bottom: 1.5rem;
    right: 1.5rem;
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    padding: 0.75rem 1rem;
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-lg);
    font-size: var(--text-sm);
    font-weight: 500;
    z-index: 1000;
    animation: slideIn 0.3s ease-out;
    max-width: 24rem;
  }
  .toast-success {
    background: #dcfce7;
    color: #166534;
    border: 1px solid #bbf7d0;
  }
  .toast-error {
    background: #fef2f2;
    color: #991b1b;
    border: 1px solid #fecaca;
  }
  .toast-icon {
    font-size: var(--text-lg);
    font-weight: 700;
  }
  .toast-message {
    flex: 1;
  }
  .toast-close {
    background: none;
    border: none;
    font-size: var(--text-lg);
    cursor: pointer;
    color: inherit;
    padding: 0 0.25rem;
    line-height: 1;
  }
  @keyframes slideIn {
    from { transform: translateX(100%); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
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