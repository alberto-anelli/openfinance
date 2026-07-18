import { h as head, a as ensure_array_like, e as escape_html } from "../../../chunks/index.js";
import { g as goto } from "../../../chunks/client.js";
import { B as Button, C as Card, T as Toast } from "../../../chunks/Toast.js";
import { A as AmountInput, D as DatePicker } from "../../../chunks/DatePicker.js";
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    const INCOME_CATEGORIES = [
      { value: "stipendio", label: "Stipendio" },
      { value: "tredicesima", label: "Tredicesima" },
      { value: "quattordicesima", label: "Quattordicesima" },
      { value: "regalo", label: "Regalo" }
    ];
    let amount = 0;
    let category = "stipendio";
    let date = today();
    let saving = false;
    let toastVisible = false;
    let toastMessage = "";
    let toastType = "success";
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
      head("pq1wk5", $$renderer3, ($$renderer4) => {
        $$renderer4.title(($$renderer5) => {
          $$renderer5.push(`<title>Aggiungi entrata — Finanze</title>`);
        });
      });
      $$renderer3.push(`<div class="page-header svelte-pq1wk5"><h1>Aggiungi entrata</h1> `);
      Button($$renderer3, {
        variant: "ghost",
        onclick: () => goto(),
        children: ($$renderer4) => {
          $$renderer4.push(`<!---->← Torna al mese`);
        }
      });
      $$renderer3.push(`<!----></div> `);
      Card($$renderer3, {
        variant: "income",
        children: ($$renderer4) => {
          $$renderer4.push(`<form><div class="form-fields svelte-pq1wk5">`);
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
          $$renderer4.push(`<!----> <div class="field svelte-pq1wk5"><label for="category" class="field-label svelte-pq1wk5">Categoria</label> `);
          $$renderer4.select(
            { id: "category", value: category, class: "select" },
            ($$renderer5) => {
              $$renderer5.push(`<!--[-->`);
              const each_array = ensure_array_like(INCOME_CATEGORIES);
              for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
                let cat = each_array[$$index];
                $$renderer5.option({ value: cat.value }, ($$renderer6) => {
                  $$renderer6.push(`${escape_html(cat.label)}`);
                });
              }
              $$renderer5.push(`<!--]-->`);
            },
            "svelte-pq1wk5"
          );
          $$renderer4.push(`</div> `);
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
          $$renderer4.push(`<!--]--> <div class="form-actions svelte-pq1wk5">`);
          Button($$renderer4, {
            type: "submit",
            disabled: saving,
            children: ($$renderer5) => {
              $$renderer5.push(`<!---->${escape_html("Salva entrata")}`);
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
