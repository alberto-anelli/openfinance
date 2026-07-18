import { h as head, b as attr, a as ensure_array_like, e as escape_html } from "../../../chunks/index.js";
import { g as goto } from "../../../chunks/client.js";
import { B as Button, C as Card, T as Toast } from "../../../chunks/Toast.js";
import { A as AmountInput, D as DatePicker } from "../../../chunks/DatePicker.js";
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let amount = 0;
    let category = "";
    let date = today();
    let saving = false;
    let toastVisible = false;
    let toastMessage = "";
    let toastType = "success";
    let suggestions = [];
    function today() {
      const d = /* @__PURE__ */ new Date();
      return d.toISOString().split("T")[0];
    }
    function handleToastDismiss() {
      toastVisible = false;
    }
    let $$settled = true;
    let $$inner_renderer;
    function $$render_inner($$renderer3) {
      head("o8s0bk", $$renderer3, ($$renderer4) => {
        $$renderer4.title(($$renderer5) => {
          $$renderer5.push(`<title>Aggiungi spesa — Finanze</title>`);
        });
      });
      $$renderer3.push(`<div class="page-header svelte-o8s0bk"><h1>Aggiungi spesa</h1> `);
      Button($$renderer3, {
        variant: "ghost",
        onclick: () => goto(),
        children: ($$renderer4) => {
          $$renderer4.push(`<!---->← Torna al mese`);
        }
      });
      $$renderer3.push(`<!----></div> `);
      Card($$renderer3, {
        children: ($$renderer4) => {
          $$renderer4.push(`<form><div class="form-fields svelte-o8s0bk">`);
          AmountInput($$renderer4, {
            label: "Importo",
            id: "amount",
            required: true,
            get value() {
              return amount;
            },
            set value($$value) {
              amount = $$value;
              $$settled = false;
            }
          });
          $$renderer4.push(`<!----> <div class="field svelte-o8s0bk"><label for="category" class="field-label svelte-o8s0bk">Categoria</label> <input id="category" type="text"${attr("value", category)} list="cat-suggestions" placeholder="es. Spesa alimentare" class="input svelte-o8s0bk" required="" maxlength="60"/> <datalist id="cat-suggestions"><!--[-->`);
          const each_array = ensure_array_like(suggestions);
          for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
            let cat = each_array[$$index];
            $$renderer4.option({ value: cat }, ($$renderer5) => {
            });
          }
          $$renderer4.push(`<!--]--></datalist></div> `);
          DatePicker($$renderer4, {
            label: "Data",
            id: "date",
            required: true,
            get value() {
              return date;
            },
            set value($$value) {
              date = $$value;
              $$settled = false;
            }
          });
          $$renderer4.push(`<!----></div> `);
          {
            $$renderer4.push("<!--[-1-->");
          }
          $$renderer4.push(`<!--]--> <div class="form-actions svelte-o8s0bk">`);
          Button($$renderer4, {
            type: "submit",
            disabled: saving,
            children: ($$renderer5) => {
              $$renderer5.push(`<!---->${escape_html("Salva spesa")}`);
            }
          });
          $$renderer4.push(`<!----> `);
          Button($$renderer4, {
            variant: "secondary",
            onclick: () => goto(),
            children: ($$renderer5) => {
              $$renderer5.push(`<!---->Annulla`);
            }
          });
          $$renderer4.push(`<!----></div></form>`);
        }
      });
      $$renderer3.push(`<!----> `);
      Toast($$renderer3, {
        message: toastMessage,
        type: toastType,
        visible: toastVisible,
        ondismiss: handleToastDismiss
      });
      $$renderer3.push(`<!---->`);
    }
    do {
      $$settled = true;
      $$inner_renderer = $$renderer2.copy();
      $$render_inner($$inner_renderer);
    } while (!$$settled);
    $$renderer2.subsume($$inner_renderer);
  });
}
export {
  _page as default
};
