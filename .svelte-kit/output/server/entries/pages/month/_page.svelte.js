import { h as head, e as escape_html, a8 as attr_class, a as ensure_array_like, a7 as derived } from "../../../chunks/index.js";
import { B as Button, T as Toast, C as Card } from "../../../chunks/Toast.js";
const API_BASE = "/finance/api";
class ApiClient {
  async request(path, options) {
    const url = `${API_BASE}${path}`;
    const res = await fetch(url, {
      headers: { "Content-Type": "application/json", ...options?.headers },
      ...options
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      throw new Error(body?.error?.message || `HTTP ${res.status}`);
    }
    if (res.status === 204) return void 0;
    return res.json();
  }
  // Transactions
  create(data) {
    return this.request("/transactions", {
      method: "POST",
      body: JSON.stringify(data)
    });
  }
  list(params) {
    const qs = new URLSearchParams();
    if (params?.year) qs.set("year", String(params.year));
    if (params?.month) qs.set("month", String(params.month));
    if (params?.type) qs.set("type", params.type);
    if (params?.category) qs.set("category", params.category);
    const query = qs.toString();
    return this.request(`/transactions${query ? `?${query}` : ""}`);
  }
  getById(id) {
    return this.request(`/transactions/${id}`);
  }
  update(id, patch) {
    return this.request(`/transactions/${id}`, {
      method: "PATCH",
      body: JSON.stringify(patch)
    });
  }
  delete(id) {
    return this.request(`/transactions/${id}`, { method: "DELETE" });
  }
  // Summary
  monthSummary(year, month) {
    return this.request(`/summary/month?year=${year}&month=${month}`);
  }
  yearSummary(year) {
    return this.request(`/summary/year?year=${year}`);
  }
  // Categories — extract unique expense categories from the full list
  async expenseCategories() {
    const txs = await this.list({ type: "expense" });
    const cats = new Set(txs.map((tx) => tx.category));
    return Array.from(cats).sort();
  }
}
const api = new ApiClient();
function formatCents(c) {
  return (c / 100).toLocaleString("it-IT", { style: "currency", currency: "EUR" });
}
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    const now = /* @__PURE__ */ new Date();
    let currentYear = now.getFullYear();
    let currentMonth = now.getMonth() + 1;
    let transactions = [];
    let monthSummary = null;
    let yearSummary = null;
    let loading = true;
    let error = "";
    let selectedCategory = null;
    let toastVisible = false;
    let toastMessage = "";
    let toastType = "success";
    let categories = derived(() => uniqCategories(transactions));
    let filteredTransactions = derived(() => transactions);
    function uniqCategories(txs) {
      const cats = new Set(txs.map((tx) => tx.category));
      return Array.from(cats).sort();
    }
    function formatDate(dateStr) {
      const d = /* @__PURE__ */ new Date(dateStr + "T00:00:00");
      return d.toLocaleDateString("it-IT", { day: "2-digit", month: "short" });
    }
    function prevMonth() {
      if (currentMonth === 1) {
        currentMonth = 12;
        currentYear--;
      } else {
        currentMonth--;
      }
      loadData();
    }
    function nextMonth() {
      if (currentMonth === 12) {
        currentMonth = 1;
        currentYear++;
      } else {
        currentMonth++;
      }
      loadData();
    }
    async function loadData() {
      loading = true;
      error = "";
      try {
        const [txs, mSummary, ySummary] = await Promise.all([
          api.list({ year: currentYear, month: currentMonth }),
          api.monthSummary(currentYear, currentMonth),
          api.yearSummary(currentYear)
        ]);
        transactions = txs;
        monthSummary = mSummary;
        yearSummary = ySummary;
      } catch (err) {
        error = err instanceof Error ? err.message : "Errore nel caricamento";
      } finally {
        loading = false;
      }
    }
    function handleToastDismiss() {
      toastVisible = false;
    }
    const monthNames = [
      "Gennaio",
      "Febbraio",
      "Marzo",
      "Aprile",
      "Maggio",
      "Giugno",
      "Luglio",
      "Agosto",
      "Settembre",
      "Ottobre",
      "Novembre",
      "Dicembre"
    ];
    head("ifvced", $$renderer2, ($$renderer3) => {
      $$renderer3.title(($$renderer4) => {
        $$renderer4.push(`<title>Riepilogo — Finanze</title>`);
      });
    });
    $$renderer2.push(`<div class="month-selector svelte-ifvced">`);
    Button($$renderer2, {
      variant: "ghost",
      onclick: prevMonth,
      children: ($$renderer3) => {
        $$renderer3.push(`<!---->◀`);
      }
    });
    $$renderer2.push(`<!----> <h2 class="month-title svelte-ifvced">${escape_html(monthNames[currentMonth - 1])} ${escape_html(currentYear)}</h2> `);
    Button($$renderer2, {
      variant: "ghost",
      onclick: nextMonth,
      children: ($$renderer3) => {
        $$renderer3.push(`<!---->▶`);
      }
    });
    $$renderer2.push(`<!----></div> `);
    if (loading) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="loading svelte-ifvced"><p>Caricamento...</p></div>`);
    } else if (error) {
      $$renderer2.push("<!--[1-->");
      Card($$renderer2, {
        variant: "expense",
        children: ($$renderer3) => {
          $$renderer3.push(`<p class="text-expense">${escape_html(error)}</p> `);
          Button($$renderer3, {
            onclick: loadData,
            children: ($$renderer4) => {
              $$renderer4.push(`<!---->Riprova`);
            }
          });
          $$renderer3.push(`<!---->`);
        }
      });
    } else {
      $$renderer2.push("<!--[-1-->");
      if (categories().length > 0) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<div class="filter-chips svelte-ifvced"><button${attr_class(`chip ${"chip-active"}`, "svelte-ifvced")}>Tutte</button> <!--[-->`);
        const each_array = ensure_array_like(categories());
        for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
          let cat = each_array[$$index];
          $$renderer2.push(`<button${attr_class(`chip ${selectedCategory === cat ? "chip-active" : ""}`, "svelte-ifvced")}>${escape_html(cat)}</button>`);
        }
        $$renderer2.push(`<!--]--></div>`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--> `);
      if (filteredTransactions().length > 0) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<div class="tx-list svelte-ifvced"><!--[-->`);
        const each_array_1 = ensure_array_like(filteredTransactions());
        for (let $$index_1 = 0, $$length = each_array_1.length; $$index_1 < $$length; $$index_1++) {
          let tx = each_array_1[$$index_1];
          Card($$renderer2, {
            variant: tx.type === "income" ? "income" : "expense",
            padding: "sm",
            children: ($$renderer3) => {
              $$renderer3.push(`<div class="tx-row svelte-ifvced"><div class="tx-info svelte-ifvced"><span class="tx-category svelte-ifvced">${escape_html(tx.category)}</span> <span class="tx-date text-muted svelte-ifvced">${escape_html(formatDate(tx.date))}</span></div> <div class="tx-amount-group svelte-ifvced"><span${attr_class(`tx-amount ${tx.type === "income" ? "text-income" : "text-expense"}`, "svelte-ifvced")}>${escape_html(tx.type === "income" ? "+" : "–")}${escape_html(formatCents(tx.amount))}</span> <button class="tx-delete svelte-ifvced" aria-label="Elimina">✕</button></div></div>`);
            }
          });
        }
        $$renderer2.push(`<!--]--></div>`);
      } else {
        $$renderer2.push("<!--[-1-->");
        Card($$renderer2, {
          padding: "lg",
          children: ($$renderer3) => {
            $$renderer3.push(`<p class="empty-state text-muted svelte-ifvced">Nessuna voce per questo mese. <a href="/finance/add-notes" class="svelte-ifvced">Aggiungi una spesa</a> o <a href="/finance/add-entry" class="svelte-ifvced">un'entrata</a>.</p>`);
          }
        });
      }
      $$renderer2.push(`<!--]--> `);
      if (monthSummary) {
        $$renderer2.push("<!--[0-->");
        Card($$renderer2, {
          variant: "summary",
          padding: "md",
          children: ($$renderer3) => {
            $$renderer3.push(`<div class="summary-grid svelte-ifvced"><div class="summary-item svelte-ifvced"><span class="summary-label svelte-ifvced">Entrate</span> <span class="summary-value text-income svelte-ifvced">${escape_html(formatCents(monthSummary.totalIncome))}</span></div> <div class="summary-item svelte-ifvced"><span class="summary-label svelte-ifvced">Uscite</span> <span class="summary-value text-expense svelte-ifvced">${escape_html(formatCents(monthSummary.totalExpenses))}</span></div> <div class="summary-item svelte-ifvced"><span class="summary-label svelte-ifvced">Differenza</span> <span${attr_class(`summary-value ${monthSummary.difference >= 0 ? "text-positive" : "text-negative"}`, "svelte-ifvced")}>${escape_html(formatCents(monthSummary.difference))}</span></div></div>`);
          }
        });
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--> `);
      if (yearSummary) {
        $$renderer2.push("<!--[0-->");
        Card($$renderer2, {
          padding: "md",
          children: ($$renderer3) => {
            $$renderer3.push(`<h3 class="year-title svelte-ifvced">Anno ${escape_html(yearSummary.year)}</h3> <div class="summary-grid svelte-ifvced"><div class="summary-item svelte-ifvced"><span class="summary-label svelte-ifvced">Totale entrate</span> <span class="summary-value text-income svelte-ifvced">${escape_html(formatCents(yearSummary.totalIncome))}</span></div> <div class="summary-item svelte-ifvced"><span class="summary-label svelte-ifvced">Totale uscite</span> <span class="summary-value text-expense svelte-ifvced">${escape_html(formatCents(yearSummary.totalExpenses))}</span></div> <div class="summary-item svelte-ifvced"><span class="summary-label svelte-ifvced">Saldo</span> <span${attr_class(`summary-value ${yearSummary.totalDifference >= 0 ? "text-positive" : "text-negative"}`, "svelte-ifvced")}>${escape_html(formatCents(yearSummary.totalDifference))}</span></div></div>`);
          }
        });
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--> `);
      if (yearSummary) {
        $$renderer2.push("<!--[0-->");
        Card($$renderer2, {
          padding: "md",
          children: ($$renderer3) => {
            $$renderer3.push(`<button class="accordion-toggle svelte-ifvced"><span>Dettaglio mensile</span> <span class="accordion-arrow svelte-ifvced">${escape_html("▼")}</span></button> `);
            {
              $$renderer3.push("<!--[-1-->");
            }
            $$renderer3.push(`<!--]-->`);
          }
        });
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]-->`);
    }
    $$renderer2.push(`<!--]--> `);
    Toast($$renderer2, {
      message: toastMessage,
      type: toastType,
      visible: toastVisible,
      ondismiss: handleToastDismiss
    });
    $$renderer2.push(`<!---->`);
  });
}
export {
  _page as default
};
