import "clsx";
function _layout($$renderer, $$props) {
  let { children } = $$props;
  $$renderer.push(`<header class="header svelte-12qhfyh"><a href="/finance/month" class="logo svelte-12qhfyh">💰 Finanze</a> <nav class="nav svelte-12qhfyh"><a href="/finance/add-notes" class="nav-link svelte-12qhfyh">+ Spesa</a> <a href="/finance/add-entry" class="nav-link svelte-12qhfyh">+ Entrata</a> <a href="/finance/month" class="nav-link svelte-12qhfyh">Mese</a></nav></header> <main class="main svelte-12qhfyh">`);
  children?.($$renderer);
  $$renderer.push(`<!----></main>`);
}
export {
  _layout as default
};
