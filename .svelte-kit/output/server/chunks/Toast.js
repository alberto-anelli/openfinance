import { b as attr, a8 as attr_class, a9 as stringify, e as escape_html } from "./index.js";
function Button($$renderer, $$props) {
  let {
    variant = "primary",
    type = "button",
    disabled = false,
    onclick,
    children
  } = $$props;
  $$renderer.push(`<button${attr("type", type)}${attr("disabled", disabled, true)}${attr_class(`btn btn-${stringify(variant)}`, "svelte-18sv61c")}>`);
  children?.($$renderer);
  $$renderer.push(`<!----></button>`);
}
function Card($$renderer, $$props) {
  let { variant = "default", padding = "md", children } = $$props;
  $$renderer.push(`<div${attr_class(`card card-${stringify(variant)} card-pad-${stringify(padding)}`, "svelte-1udyrqm")}>`);
  children?.($$renderer);
  $$renderer.push(`<!----></div>`);
}
function Toast($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { message = "", type = "success", visible = false, ondismiss } = $$props;
    if (visible && message) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div${attr_class(`toast toast-${stringify(type)}`, "svelte-1cpok13")} role="alert"><span class="toast-icon svelte-1cpok13">${escape_html(type === "success" ? "✓" : "✕")}</span> <span class="toast-message svelte-1cpok13">${escape_html(message)}</span> <button class="toast-close svelte-1cpok13">×</button></div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]-->`);
  });
}
export {
  Button as B,
  Card as C,
  Toast as T
};
