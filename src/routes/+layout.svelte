<script lang="ts">
  import '../lib/theme.css';
  import { getBasePath } from '$lib/base';
  let base = $derived(getBasePath());
  let { children }: { children?: import('svelte').Snippet } = $props();

  // Detect active route for nav highlight
  let activeRoute = $derived(
    typeof window !== 'undefined' ? window.location.pathname : ''
  );
</script>

<header class="header">
  <a href={base + '/app'} class="logo">
    <span class="logo-bracket">[</span>
    <span class="logo-text">Bilancio</span>
    <span class="logo-bracket">]</span>
  </a>
  <nav class="nav">
    <a href={base + '/add-notes'} class="nav-link">
      <span class="nav-arrow">&#x25BC;</span>
      <span>Spesa</span>
    </a>
    <a href={base + '/add-entry'} class="nav-link">
      <span class="nav-arrow">&#x25B2;</span>
      <span>Entrata</span>
    </a>
    <a href={base + '/app'} class="nav-link" class:nav-link-active={activeRoute === base + '/app'}>
      <span class="nav-dot">&#x25A6;</span>
      <span>Panoramica</span>
    </a>
    <a href={base + '/app/account'} class="nav-link" class:nav-link-active={activeRoute.includes('/app/account')}>
      <span class="nav-dot">&#x25A3;</span>
      <span>Conti</span>
    </a>
    <a href={base + '/month'} class="nav-link" class:nav-link-active={activeRoute.includes('/month')}>
      <span class="nav-dot">&#x25CB;</span>
      <span>Mese</span>
    </a>
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
    padding: var(--space-sm) var(--space-lg);
    background: var(--color-surface);
    border-bottom: 1px solid var(--color-border);
    position: sticky;
    top: 0;
    z-index: 100;
  }

  .logo {
    display: flex;
    align-items: center;
    gap: 0;
    text-decoration: none;
    font-family: var(--font-mono);
  }
  .logo:hover {
    opacity: 0.8;
    text-decoration: none;
  }
  .logo-bracket {
    color: var(--color-primary);
    font-weight: 700;
    font-size: var(--text-lg);
  }
  .logo-text {
    font-size: var(--text-base);
    font-weight: 700;
    color: var(--color-text);
    letter-spacing: 0;
    padding: 0 0.15rem;
  }

  .nav {
    display: flex;
    gap: 1px;
  }
  .nav-link {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.375rem 0.6rem;
    font-size: var(--text-xs);
    font-family: var(--font-mono);
    color: var(--color-text-secondary);
    border: 1px solid transparent;
    text-decoration: none;
    transition: background 0.1s, color 0.1s;
  }
  .nav-link:hover {
    background: var(--color-surface-raised);
    color: var(--color-text);
    text-decoration: none;
  }
  .nav-link-active {
    background: var(--color-surface-raised);
    color: var(--color-text);
    border-color: var(--color-border);
  }
  .nav-arrow, .nav-dot {
    font-size: 9px;
    flex-shrink: 0;
  }

  .main {
    max-width: 56rem;
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
      padding: 0.375rem 0.35rem;
      font-size: 10px;
    }
    .nav-arrow, .nav-dot {
      display: none;
    }
  }
</style>