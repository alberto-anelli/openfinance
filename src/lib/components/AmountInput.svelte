<script lang="ts">
  /**
   * Amount input in EUR, converts to centesimi for the API.
   * Displays formatted value with € symbol.
   *
   * Formatting is intentionally deferred to blur (not done on every keystroke)
   * so the user can freely type a multi-digit number without the field
   * reformatting underneath them.  Only external value changes (form reset,
   * programmatic set) reformat the display while the field is not focused.
   */
  import { formatInput, parseInput } from '$lib/format';

  let { value = $bindable(0), onchange, id, label, required = false }: {
    value: number;       // centesimi
    onchange?: (centesimi: number) => void;
    id?: string;
    label?: string;
    required?: boolean;
  } = $props();

  let displayValue = $state(value > 0 ? formatInput(value) : '');
  let previousValue = value;
  let focused = $state(false);

  // Sync displayValue from the value prop when it changes externally
  $effect(() => {
    if (value !== previousValue) {
      previousValue = value;
      if (!focused) {
        displayValue = value > 0 ? formatInput(value) : '';
      }
    }
  });

  function handleFocus() {
    focused = true;
  }

  function handleInput(e: Event) {
    const target = e.target as HTMLInputElement;
    displayValue = target.value;
    const centesimi = parseInput(target.value);
    value = centesimi;
    onchange?.(centesimi);
  }

  function handleBlur() {
    focused = false;
    if (value > 0) {
      displayValue = formatInput(value);
    } else {
      displayValue = '';
    }
  }
</script>

<div class="amount-input">
  {#if label}
    <label for={id} class="label">{label}</label>
  {/if}
  <div class="input-wrapper">
    <span class="currency">></span>
    <input
      {id}
      type="text"
      inputmode="decimal"
      placeholder="0,00"
      value={displayValue}
      oninput={handleInput}
      onfocus={handleFocus}
      onblur={handleBlur}
      {required}
      class="input"
      aria-label={label || 'Importo'}
    />
  </div>
</div>

<style>
  .amount-input {
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
  }
  .label {
    font-size: var(--text-xs);
    font-weight: 500;
    color: var(--color-text-secondary);
    font-family: var(--font-mono);
  }
  .input-wrapper {
    position: relative;
    display: flex;
    align-items: center;
  }
  .currency {
    position: absolute;
    left: 0.5rem;
    color: var(--color-primary);
    font-weight: 700;
    font-size: var(--text-sm);
    pointer-events: none;
    font-family: var(--font-mono);
  }
  .input {
    width: 100%;
    padding: 0.5rem 0.5rem 0.5rem 1.6rem;
    font-size: var(--text-sm);
    font-family: var(--font-mono);
    border: 1px solid var(--color-border);
    background: var(--color-bg);
    color: var(--color-text);
    transition: border-color 0.1s;
    outline: none;
  }
  .input:focus {
    border-color: var(--color-primary);
  }
  .input::placeholder {
    color: var(--color-text-dim);
  }
</style>