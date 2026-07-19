<script lang="ts">
  import { goto } from '$app/navigation';
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
  let saving = $state(false);
  let error = $state('');
  let toastVisible = $state(false);
  let toastMessage = $state('');
  let toastType: 'success' | 'error' = $state('success');

  function today(): string {
    const d = new Date();
    return d.toISOString().split('T')[0];
  }

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
      await api.create({
        type: 'income',
        amount,
        category,
        date,
      });
      toastMessage = 'Entrata aggiunta!';
      toastType = 'success';
      toastVisible = true;
      // Reset form
      amount = 0;
      category = 'stipendio';
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
  <title>Aggiungi entrata — Finanze</title>
</svelte:head>

<div class="page-header">
  <h1>Aggiungi entrata</h1>
  <Button variant="ghost" onclick={() => goto(getBasePath() + '/month')}>← Torna al mese</Button>
</div>

<Card variant="income">
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
        {saving ? 'Salvataggio...' : 'Salva entrata'}
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
  .select {
    padding: 0.625rem 0.75rem;
    font-size: var(--text-base);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background: var(--color-surface);
    color: var(--color-text);
    transition: border-color 0.15s, box-shadow 0.15s;
    outline: none;
    width: 100%;
    cursor: pointer;
    appearance: auto;
  }
  .select:focus {
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