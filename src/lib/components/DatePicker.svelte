<script lang="ts">
  let { value = $bindable(''), onchange, id, label, required = false }: {
    value?: string;       // YYYY-MM-DD
    onchange?: (date: string) => void;
    id?: string;
    label?: string;
    required?: boolean;
  } = $props();

  function handleChange(e: Event) {
    const target = e.target as HTMLInputElement;
    value = target.value;
    onchange?.(target.value);
  }
</script>

<div class="date-picker">
  {#if label}
    <label for={id} class="label">{label}</label>
  {/if}
  <input
    {id}
    type="date"
    bind:value
    onchange={handleChange}
    {required}
    class="input"
    aria-label={label || 'Data'}
  />
</div>

<style>
  .date-picker {
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
  }
  .label {
    font-size: var(--text-sm);
    font-weight: 500;
    color: var(--color-text);
  }
  .input {
    width: 100%;
    padding: 0.625rem 0.75rem;
    font-size: var(--text-base);
    font-family: var(--font-sans);
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
</style>