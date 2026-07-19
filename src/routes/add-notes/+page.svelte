<script lang="ts">
  import { goto } from '$app/navigation';
  import { getBasePath } from '$lib/base';
  import { api } from '$lib/api/client';
  import Button from '$lib/components/Button.svelte';
  import AmountInput from '$lib/components/AmountInput.svelte';
  import DatePicker from '$lib/components/DatePicker.svelte';
  import Card from '$lib/components/Card.svelte';
  import Toast from '$lib/components/Toast.svelte';

  let amount = $state(0);
  let category = $state('');
  let date = $state(today());
  let saving = $state(false);
  let error = $state('');
  let toastVisible = $state(false);
  let toastMessage = $state('');
  let toastType: 'success' | 'error' = $state('success');
  let suggestions: string[] = $state([]);

  function today(): string {
    const d = new Date();
    return d.toISOString().split('T')[0];
  }

  // Load existing categories for datalist suggestions
  $effect(() => {
    api.expenseCategories().then(cats => {
      suggestions = cats;
    }).catch(() => { /* ignore */ });
  });

  function validate(): boolean {
    error = '';
    if (amount <= 0) { error = 'Inserisci un importo valido'; return false; }
    const trimmed = category.trim();
    if (trimmed.length === 0) { error = 'Inserisci una categoria'; return false; }
    if (trimmed.length > 60) { error = 'La categoria deve essere massimo 60 caratteri'; return false; }
    if (!date) { error = 'Inserisci una data'; return false; }
    return true;
  }

  async function handleSubmit(e: Event) {
    e.preventDefault();
    if (!validate()) return;

    saving = true;
    try {
      await api.create({
        type: 'expense',
        amount,
        category: category.trim(),
        date,
      });
      toastMessage = 'Spesa aggiunta!';
      toastType = 'success';
      toastVisible = true;
      // Reset form
      amount = 0;
      category = '';
      date = today();
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
  <title>Aggiungi spesa — Finanze</title>
</svelte:head>

<div class="page-header">
  <h1>Aggiungi spesa</h1>
  <Button variant="ghost" onclick={() => goto(getBasePath() + '/month')}>← Torna al mese</Button>
</div>

<Card>
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
          list="cat-suggestions"
          placeholder="es. Spesa alimentare"
          class="input"
          required
          maxlength="60"
        />
        <datalist id="cat-suggestions">
          {#each suggestions as cat}
            <option value={cat}></option>
          {/each}
        </datalist>
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
      <Button type="submit" disabled={saving}>
        {saving ? 'Salvataggio...' : 'Salva spesa'}
      </Button>
      <Button variant="secondary" onclick={() => goto(getBasePath() + '/month')}>
        Annulla
      </Button>
    </div>
  </form>
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
    font-size: var(--text-sm);
    font-weight: 500;
    color: var(--color-text);
  }
  .input {
    padding: 0.625rem 0.75rem;
    font-size: var(--text-base);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background: var(--color-surface);
    color: var(--color-text);
    transition: border-color 0.15s, box-shadow 0.15s;
    outline: none;
    width: 100%;
  }
  .input:focus {
    border-color: var(--color-primary);
    box-shadow: 0 0 0 3px var(--blue-100);
  }
  .error {
    margin-top: var(--space-md);
    padding: 0.5rem 0.75rem;
    background: #fef2f2;
    color: #991b1b;
    border-radius: var(--radius-md);
    font-size: var(--text-sm);
  }
  .form-actions {
    display: flex;
    gap: var(--space-sm);
    margin-top: var(--space-lg);
  }
</style>