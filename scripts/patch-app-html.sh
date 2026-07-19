#!/usr/bin/env bash
# Post-build script: patches the generated app.html so the SvelteKit base path
# is detected dynamically from the browser URL instead of being hardcoded.
#
# This allows the same build to be served from multiple paths
# (e.g. /finance, /aa/finance, /content/finance) via nginx rewrites.
#
# The script:
#   1. Finds the __sveltekit_* config variable in the generated script
#   2. Injects a dynamic base-path detection BEFORE the variable assignment
#   3. Replaces the hardcoded base/assets with the detected value

set -euo pipefail

APP_HTML="build/app.html"

if [ ! -f "$APP_HTML" ]; then
  echo "ERROR: $APP_HTML not found. Run 'npm run build:app' first."
  exit 1
fi

# === Step 1: extract the __sveltekit_* variable name ===
# The generated script contains a line like:
#   __sveltekit_1ogc10y = { base: "/finance", assets: "/finance" };
VAR_NAME=$(grep -oP '__sveltekit_[a-zA-Z0-9_]+\s*=' "$APP_HTML" | head -1 | tr -d ' =')

if [ -z "$VAR_NAME" ]; then
  echo "ERROR: Could not find __sveltekit_* variable in $APP_HTML"
  exit 1
fi

echo "Found SvelteKit config variable: $VAR_NAME"

# === Step 2: inject the dynamic base detection ===
# We replace the assignment line with a dynamic version.
# The generated script has:
#   __sveltekit_XXXXX = { base: "/finance", assets: "/finance" };
# We replace it with:
#   var __sveltekit_base = ...; __sveltekit_XXXXX = { base: __sveltekit_base, assets: __sveltekit_base };

# Use perl for multi-line-aware replacement
perl -i -pe "
  if (/\Q$VAR_NAME\E\s*=\s*\{/) {
    s/\Q$VAR_NAME\E\s*=\s*\{[^}]*\};/
      (function(){
        var p = window.location.pathname,
            i = p.lastIndexOf('\/finance');
        return i !== -1 ? p.substring(0, i + 8) : '\/finance';
      })();
      var b = _sveltekit_base;
      $VAR_NAME = { base: b, assets: b };
    /x;
  }
" "$APP_HTML"

echo "Patched $APP_HTML: base path is now detected dynamically from browser URL."