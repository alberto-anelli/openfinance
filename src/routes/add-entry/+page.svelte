<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { getBasePath } from '$lib/base';
  import { api } from '$lib/api/client';
  import Button from '$lib/components/Button.svelte';
  import AmountInput from '$lib/components/AmountInput.svelte';
  import DatePicker from '$lib/components/DatePicker.svelte';
  import Card from '$lib/components/Card.svelte';
  import Toast from '$lib/components/Toast.svelte';

  const INCOME_CATEGORIES = [
    { value: 'stipendio', label: 'Stipendio' },
    { value: 'tredicesima', label: 'Tredicesima' },
    { value: 'quattordicesima', label: 'Quattordicesima' },
    { value: 'regalo', label: 'Regalo' },
  ];

  let amount = $state(0);
  let category = $state('stipendio');
  let date = $state(today());
  let accountId = $state('');
  let saving = $state(false);
  let loading = $state(false);
  let error = $state('');
  let toastVisible = $state(false);
  let toastMessage = $state('');
  let toastType: 'success' | 'error' = $state('success');
  let accounts: { id: string; name: string }[] = $state([]);

  const editingId = $derived(page.url.searchParams.get('id'));

  function today(): string {
    const d = new Date();
    return d.toISOString().split('T')[0];
  }

  // Load existing transaction when editing
  $effect(() => {
    if (editingId) {
      loading = true;
      api.getById(editingId).then(tx => {
        amount = tx.amount;
        category = tx.category;
        date = tx.date;
        accountId = tx.accountId ?? '';
      }).catch(err => {
        error = err instanceof Error ? err.message : 'Errore nel caricamento';
      }).finally(() => {
        loading = false;
      });
    }
  });

  // Load accounts for the account selector
  $effect(() => {
    api.listAccounts().then(accs => {
      accounts = accs.map(a => ({ id: a.id, name: a.name }));
    }).catch(() => { /* ignore */ });
  });

  function validate(): boolean {
    error = '';
    if (amount <= 0) { error = 'Inserisci un importo valido'; return false; }
    if (!date) { error = 'Inserisci una data'; return false; }
    return true;
  }

  async function handleSubmit(e: Event) {
    e.preventDefault();
    if (!validate()) return;

    saving = true;
    try {
      if (editingId) {
        await api.update(editingId, { amount, category, date, accountId: accountId || undefined });
        toastMessage = 'Entrata modificata!';
        toastType = 'success';
        toastVisible = true;
        setTimeout(() => goto(getBasePath() + '/month'), 1000);
      } else {
        await api.create({
          type: 'income',
          amount,
          category,
          date,
          accountId: accountId || undefined,
        });
        toastMessage = 'Entrata aggiunta!';
        toastType = 'success';
        toastVisible = true;
        // Reset form
        amount = 0;
        category = 'stipendio';
        date = today();
      }
    } catch (err) {
      toastMessage = err instanceof Error ? err.message : 'Errore durante il salvataggio';
      toastType = 'error';
      toastVisible = true;
    } finally {
      saving = false;
    }
  }

  function handleToastDismiss() {
    toastVisible = false;
  }
</script>

<svelte:head>
  <title>{editingId ? 'Modifica entrata' : 'Aggiungi entrata'} — Bilancio</title>
</svelte:head>

<div class="page-header">
  <h1>{editingId ? 'Modifica entrata' : 'Aggiungi entrata'}</h1>
  <Button variant="ghost" onclick={() => goto(getBasePath() + '/month')}>← Torna al mese</Button>
</div>

<Card variant="income">
  {#if loading}
    <p class="loading-text">Caricamento...</p>
  {:else}
    <form onsubmit={handleSubmit}>
      <div class="form-fields">
        <AmountInput
          bind:value={amount}
          label="Importo"
          id="amount"
          required
        />

        <div class="field">
          <label for="category" class="field-label">Categoria</label>
          <select id="category" bind:value={category} class="select">
            {#each INCOME_CATEGORIES as cat}
              <option value={cat.value}>{cat.label}</option>
            {/each}
          </select>
        </div>

        <div class="field">
          <label for="account" class="field-label">
            Conto <span class="optional">(opzionale)</span>
          </label>
          <select id="account" bind:value={accountId} class="select">
            <option value="">— Nessun conto —</option>
            {#each accounts as acc}
              <option value={acc.id}>{acc.name}</option>
            {/each}
          </select>
        </div>

        <DatePicker
          bind:value={date}
          label="Data"
          id="date"
          required
        />
      </div>

      {#if error}
        <p class="error" role="alert">{error}</p>
      {/if}

      <div class="form-actions">
        <Button type="submit" disabled={saving || loading}>
          {saving ? 'Salvataggio...' : editingId ? 'Salva modifiche' : 'Salva entrata'}
        </Button>
        <Button variant="secondary" onclick={() => goto(getBasePath() + '/month')}>
          Annulla
        </Button>
      </div>
    </form>
  {/if}
</Card>

<Toast
  message={toastMessage}
  type={toastType}
  visible={toastVisible}
  ondismiss={handleToastDismiss}
/>

<style>
  .page-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: var(--space-lg);
  }
  .page-header h1 { font-family: var(--font-body); }
  .loading-text {
    text-align: center;
    padding: var(--space-2xl);
    color: var(--color-text-secondary);
    font-family: var(--font-body);
  }
  .form-fields {
    display: flex;
    flex-direction: column;
    gap: var(--space-md);
  }
  .field {
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
  }
  .field-label {
    font-size: var(--text-xs);
    font-weight: 500;
    color: var(--color-text-secondary);
    font-family: var(--font-body);
  }
  .optional {
    font-weight: 400;
    color: var(--color-text-dim);
    font-size: 10px;
  }
  .select {
    padding: 0.5rem 0.5rem;
    font-size: var(--text-sm);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background: var(--color-bg);
    color: var(--color-text);
    transition: border-color 0.1s;
    outline: none;
    width: 100%;
    cursor: pointer;
    font-family: var(--font-body);
  }
  .select:focus {
    border-color: var(--color-primary);
  }
  .error {
    margin-top: var(--space-md);
    padding: 0.4rem 0.5rem;
    background: var(--color-expense-bg);
    color: var(--color-negative);
    font-size: var(--text-xs);
    font-family: var(--font-body);
  }
  .form-actions {
    display: flex;
    gap: var(--space-sm);
    margin-top: var(--space-lg);
  }
</style>