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
    <svg class="logo-icon" viewBox="0 0 28 28" fill="none" aria-hidden="true">
      <rect x="2" y="10" width="6" height="14" rx="1.5" class="logo-bar logo-bar-1" />
      <rect x="11" y="4" width="6" height="20" rx="1.5" class="logo-bar logo-bar-2" />
      <rect x="20" y="7" width="6" height="17" rx="1.5" class="logo-bar logo-bar-3" />
    </svg>
    <span class="logo-text">Bilancio</span>
  </a>
  <nav class="nav">
    <a href={base + '/add-notes'} class="nav-link">
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true" class="nav-icon">
        <path d="M7 1v12M1 7h12" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
      </svg>
      Spesa
    </a>
    <a href={base + '/add-entry'} class="nav-link">
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true" class="nav-icon">
        <path d="M7 1v12M1 7h12" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
      </svg>
      Entrata
    </a>
    <a href={base + '/app'} class="nav-link" class:nav-link-active={activeRoute === base + '/app'}>
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true" class="nav-icon">
        <rect x="1" y="1" width="5" height="5" rx="1" stroke="currentColor" stroke-width="1.5" />
        <rect x="8" y="1" width="5" height="5" rx="1" stroke="currentColor" stroke-width="1.5" />
        <rect x="1" y="8" width="5" height="5" rx="1" stroke="currentColor" stroke-width="1.5" />
        <rect x="8" y="8" width="5" height="5" rx="1" stroke="currentColor" stroke-width="1.5" />
      </svg>
      Panoramica
    </a>
    <a href={base + '/app/account'} class="nav-link" class:nav-link-active={activeRoute.includes('/app/account')}>
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true" class="nav-icon">
        <rect x="1" y="1" width="5" height="5" rx="1" stroke="currentColor" stroke-width="1.5" />
        <rect x="8" y="1" width="5" height="5" rx="1" stroke="currentColor" stroke-width="1.5" />
        <rect x="1" y="8" width="5" height="5" rx="1" stroke="currentColor" stroke-width="1.5" />
        <rect x="8" y="8" width="5" height="5" rx="1" stroke="currentColor" stroke-width="1.5" />
      </svg>
      Conti
    </a>
    <a href={base + '/month'} class="nav-link" class:nav-link-active={activeRoute.includes('/month')}>
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true" class="nav-icon">
        <rect x="1" y="3" width="12" height="10" rx="1.5" stroke="currentColor" stroke-width="1.5" />
        <path d="M1 6h12" stroke="currentColor" stroke-width="1.5" />
        <path d="M4 1v4M10 1v4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
      </svg>
      Mese
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
    background: rgba(255, 255, 255, 0.82);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border-bottom: 1px solid var(--color-border);
    position: sticky;
    top: 0;
    z-index: 100;
  }

  .logo {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    text-decoration: none;
    transition: opacity 0.15s;
  }
  .logo:hover {
    opacity: 0.75;
    text-decoration: none;
  }
  .logo-icon {
    width: 24px;
    height: 24px;
  }
  .logo-bar {
    fill: var(--color-primary);
    transition: height 0.2s ease;
  }
  .logo-bar-1 { height: 14px; y: 10; }
  .logo-bar-2 { height: 20px; y: 4; }
  .logo-bar-3 { height: 17px; y: 7; }
  .logo-text {
    font-size: var(--text-lg);
    font-weight: 700;
    color: var(--color-text);
    letter-spacing: -0.02em;
  }

  .nav {
    display: flex;
    gap: var(--space-xs);
  }
  .nav-link {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    padding: 0.375rem 0.7rem;
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
  .nav-link-active {
    background: var(--gray-100);
    color: var(--color-text);
  }
  .nav-icon {
    flex-shrink: 0;
  }

  .main {
    max-width: 52rem;
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
      padding: 0.375rem 0.45rem;
      font-size: var(--text-xs);
    }
    .logo-text {
      display: none;
    }
    .nav-icon {
      display: none;
    }
  }
</style>