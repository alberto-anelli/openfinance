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

  let amount = $state(0);
  let category = $state('');
  let description = $state('');
  let date = $state(today());
  let accountId = $state('');
  let saving = $state(false);
  let loading = $state(false);
  let error = $state('');
  let toastVisible = $state(false);
  let toastMessage = $state('');
  let toastType: 'success' | 'error' = $state('success');
  let suggestions: string[] = $state([]);
  let accounts: { id: string; name: string }[] = $state([]);

  const editingId = $derived(page.url.searchParams.get('id'));

  function today(): string {
    const d = new Date();
    return d.toISOString().split('T')[0];
  }

  // Load existing categories for tag suggestions
  $effect(() => {
    api.expenseCategories().then(cats => {
      suggestions = cats;
    }).catch(() => { /* ignore */ });
  });

  // Load accounts for the account selector
  $effect(() => {
    api.listAccounts().then(accs => {
      accounts = accs.map(a => ({ id: a.id, name: a.name }));
    }).catch(() => { /* ignore */ });
  });

  // Load existing transaction when editing
  $effect(() => {
    if (editingId) {
      loading = true;
      api.getById(editingId).then(tx => {
        amount = tx.amount;
        category = tx.category;
        description = tx.description ?? '';
        date = tx.date;
      }).catch(err => {
        error = err instanceof Error ? err.message : 'Errore nel caricamento';
      }).finally(() => {
        loading = false;
      });
    }
  });

  function validate(): boolean {
    error = '';
    if (amount <= 0) { error = 'Inserisci un importo valido'; return false; }
    const trimmed = category.trim();
    if (trimmed.length === 0) { error = 'Inserisci una categoria'; return false; }
    if (trimmed.length > 60) { error = 'La categoria deve essere massimo 60 caratteri'; return false; }
    if (!date) { error = 'Inserisci una data'; return false; }
    if (description.length > 200) { error = 'La descrizione deve essere massimo 200 caratteri'; return false; }
    return true;
  }

  async function handleSubmit(e: Event) {
    e.preventDefault();
    if (!validate()) return;

    saving = true;
    const payload = {
      amount,
      category: category.trim(),
      description: description.trim() || undefined,
      date,
      accountId: accountId || undefined,
    };

    try {
      if (editingId) {
        await api.update(editingId, payload);
        toastMessage = 'Spesa modificata!';
        toastType = 'success';
        toastVisible = true;
        setTimeout(() => goto(getBasePath() + '/month'), 1000);
      } else {
        await api.create({ type: 'expense', ...payload });
        toastMessage = 'Spesa aggiunta!';
        toastType = 'success';
        toastVisible = true;
        // Reset form
        amount = 0;
        category = '';
        description = '';
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

  function selectCategory(cat: string) {
    category = cat;
  }

  function handleToastDismiss() {
    toastVisible = false;
  }
</script>

<svelte:head>
  <title>{editingId ? 'Modifica spesa' : 'Aggiungi spesa'} — Bilancio</title>
</svelte:head>

<div class="page-header">
  <h1>{editingId ? 'Modifica spesa' : 'Aggiungi spesa'}</h1>
  <Button variant="ghost" onclick={() => goto(getBasePath() + '/month')}>← Torna al mese</Button>
</div>

<Card>
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
          <input
            id="category"
            type="text"
            bind:value={category}
            placeholder="es. Spesa alimentare"
            class="input"
            required
            maxlength="60"
          />
          {#if suggestions.length > 0}
            <div class="category-tags">
              {#each suggestions as cat}
                <button
                  type="button"
                  class="tag"
                  class:tag-active={category === cat}
                  onclick={() => selectCategory(cat)}
                >
                  {cat}
                </button>
              {/each}
            </div>
          {/if}
        </div>

        <div class="field">
          <label for="description" class="field-label">
            Descrizione <span class="optional">(opzionale)</span>
          </label>
          <input
            id="description"
            type="text"
            bind:value={description}
            placeholder="es. Cena al ristorante"
            class="input"
            maxlength="200"
          />
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
          {saving ? 'Salvataggio...' : editingId ? 'Salva modifiche' : 'Salva spesa'}
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
  .input {
    padding: 0.5rem 0.5rem;
    font-size: var(--text-sm);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background: var(--color-bg);
    color: var(--color-text);
    transition: border-color 0.1s;
    outline: none;
    width: 100%;
    font-family: var(--font-body);
  }
  .input:focus {
    border-color: var(--color-primary);
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
  .category-tags {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-xs);
    margin-top: var(--space-xs);
  }
  .tag {
    padding: 0.2rem 0.5rem;
    font-size: 10px;
    font-weight: 500;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    background: var(--color-surface);
    color: var(--color-text-secondary);
    cursor: pointer;
    transition: all 0.1s;
    font-family: var(--font-body);
    line-height: 1.4;
  }
  .tag:hover {
    border-color: var(--color-primary);
    color: var(--color-primary);
  }
  .tag-active {
    background: var(--color-primary);
    color: var(--color-bg);
    border-color: var(--color-primary);
  }
  .tag-active:hover {
    color: var(--color-bg);
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