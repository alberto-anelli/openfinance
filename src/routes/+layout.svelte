<script lang="ts">
  import '../lib/theme.css';
  import { getBasePath } from '$lib/base';
  let base = $derived(getBasePath());
  let { children }: { children?: import('svelte').Snippet } = $props();
</script>

<header class="header">
  <a href={base + '/month'} class="logo">💰 Finanze</a>
  <nav class="nav">
    <a href={base + '/add-notes'} class="nav-link">+ Spesa</a>
    <a href={base + '/add-entry'} class="nav-link">+ Entrata</a>
    <a href={base + '/month'} class="nav-link">Mese</a>
  </nav>
</header>

<main class="main">
  {@render children?.()}
</main>

<style>
  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-md) var(--space-lg);
    background: var(--color-surface);
    border-bottom: 1px solid var(--color-border);
    position: sticky;
    top: 0;
    z-index: 100;
  }
  .logo {
    font-size: var(--text-lg);
    font-weight: 700;
    color: var(--color-primary);
    text-decoration: none;
  }
  .logo:hover {
    text-decoration: none;
  }
  .nav {
    display: flex;
    gap: var(--space-sm);
  }
  .nav-link {
    padding: 0.375rem 0.75rem;
    font-size: var(--text-sm);
    font-weight: 500;
    color: var(--color-text-secondary);
    border-radius: var(--radius-md);
    text-decoration: none;
    transition: background 0.15s, color 0.15s;
  }
  .nav-link:hover {
    background: var(--gray-100);
    color: var(--color-text);
    text-decoration: none;
  }
  .main {
    max-width: 48rem;
    margin: 0 auto;
    padding: var(--space-lg);
  }

  @media (max-width: 640px) {
    .header {
      padding: var(--space-sm) var(--space-md);
    }
    .main {
      padding: var(--space-md);
    }
    .nav-link {
      padding: 0.375rem 0.5rem;
      font-size: var(--text-xs);
    }
  }
</style>
