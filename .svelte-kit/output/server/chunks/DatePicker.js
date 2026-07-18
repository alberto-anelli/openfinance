import { b as attr, e as escape_html, c as bind_props } from "./index.js";
function AmountInput($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let {
      value = 0,
      onchange,
      id,
      label,
      required = false
      // centesimi
    } = $$props;
    let displayValue = "";
    $$renderer2.push(`<div class="amount-input svelte-wryw0c">`);
    if (label) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<label${attr("for", id)} class="label svelte-wryw0c">${escape_html(label)}</label>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> <div class="input-wrapper svelte-wryw0c"><span class="currency svelte-wryw0c">€</span> <input${attr("id", id)} type="text" inputmode="decimal" placeholder="0,00"${attr("value", displayValue)}${attr("required", required, true)} class="input svelte-wryw0c"${attr("aria-label", label || "Importo")}/></div></div>`);
    bind_props($$props, { value });
  });
}
function DatePicker($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let {
      value = "",
      onchange,
      id,
      label,
      required = false
      // YYYY-MM-DD
    } = $$props;
    $$renderer2.push(`<div class="date-picker svelte-zmry26">`);
    if (label) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<label${attr("for", id)} class="label svelte-zmry26">${escape_html(label)}</label>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> <input${attr("id", id)} type="date"${attr("value", value)}${attr("required", required, true)} class="input svelte-zmry26"${attr("aria-label", label || "Data")}/></div>`);
    bind_props($$props, { value });
  });
}
export {
  AmountInput as A,
  DatePicker as D
};
