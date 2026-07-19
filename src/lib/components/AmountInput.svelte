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
  // (e.g. form reset, programmatic set).  Skip while the user is actively
  // editing — handleBlur takes care of formatting then.
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
    <span class="currency">€</span>
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
    font-size: var(--text-sm);
    font-weight: 500;
    color: var(--color-text);
  }
  .input-wrapper {
    position: relative;
    display: flex;
    align-items: center;
  }
  .currency {
    position: absolute;
    left: 0.75rem;
    color: var(--color-text-secondary);
    font-weight: 500;
    font-size: var(--text-base);
    pointer-events: none;
  }
  .input {
    width: 100%;
    padding: 0.625rem 0.75rem 0.625rem 2rem;
    font-size: var(--text-base);
    font-family: var(--font-mono);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background: var(--color-surface);
    color: var(--color-text);
    transition: border-color 0.15s, box-shadow 0.15s;
    outline: none;
  }
  .input:focus {
    border-color: var(--color-primary);
    box-shadow: 0 0 0 3px var(--blue-100);
  }
  .input::placeholder {
    color: var(--gray-400);
  }
</style>