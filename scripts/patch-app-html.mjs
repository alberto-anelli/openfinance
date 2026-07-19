/**
 * Post-build script: patches the generated app.html so the SvelteKit base
 * path is detected dynamically from the browser URL instead of the
 * build-time hardcoded value.
 *
 * This allows the same build to be served from multiple paths
 * (e.g. /finance, /aa/finance, /content/finance) via nginx rewrites.
 *
 * Usage: node scripts/patch-app-html.mjs
 * Run after `npm run build:app`.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const appHtml = join(__dirname, '..', 'build', 'app.html');

const DYNAMIC_BASE_JS = `
    var __sb = (function(){
      var p = window.location.pathname,
          i = p.lastIndexOf('/finance');
      return i !== -1 ? p.substring(0, i + 8) : '/finance';
    })();`;

function main() {
  let html = readFileSync(appHtml, 'utf-8');

  // Find the __sveltekit_* variable assignment
  // Pattern: __sveltekit_XXXXX = { base: "/finance", assets: "/finance" };
  const re = /(__sveltekit_[a-zA-Z0-9_]+)\s*=\s*\{[^}]*base\s*:\s*"[^"]*"[^}]*\};/;
  const match = html.match(re);

  if (!match) {
    console.error('ERROR: Could not find __sveltekit_* config variable in build/app.html');
    process.exit(1);
  }

  const varName = match[1];
  const fullMatch = match[0];

  console.log(`Found SvelteKit config variable: ${varName}`);

  // Replace the hardcoded assignment with dynamic detection
  const replacement = `${DYNAMIC_BASE_JS}
    ${varName} = { base: __sb, assets: __sb };`;

  html = html.replace(fullMatch, replacement);

  writeFileSync(appHtml, html, 'utf-8');
  console.log(`Patched build/app.html — base path is now detected dynamically from browser URL.`);
}

main();