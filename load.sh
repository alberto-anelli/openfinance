#!/usr/bin/env bash
set -uo pipefail

##############################################################################
# Finance API - Load Test Script (read + write)
##############################################################################

# ================== CONFIGURAZIONE ==================
BASIC_AUTH_B64="dmVyb25pY2E6cHJpbmdsZTE4MTgxOA=="   # <-- Inserisci qui la basic auth in base64 (es: "dXNlcjpwYXNz"). Lascia vuoto se non serve.
FINANCE_BASE_URL="https://knuth.li/finance/api"
BASE_URL="${FINANCE_BASE_URL:-http://127.0.0.1:3900/api}"
CONCURRENCY="${FINANCE_LT_CONCURRENCY:-10}"
REQUESTS_PER_WORKER="${FINANCE_LT_REQUESTS:-50}"
TIMEOUT="${FINANCE_LT_TIMEOUT:-5}"
YEAR="${FINANCE_LT_YEAR:-2026}"
MONTH="${FINANCE_LT_MONTH:-7}"

RESULT_DIR="$(mktemp -d /tmp/finance-loadtest.XXXXXX)"
CURL_AUTH_ARGS=()
if [ -n "$BASIC_AUTH_B64" ]; then
  CURL_AUTH_ARGS=(-H "Authorization: Basic ${BASIC_AUTH_B64}")
fi

CATEGORIES=("Spesa" "Bollette" "Trasporti" "Stipendio" "Bonus" "Affitto" "Svago" "Salute")

log() { echo "[$(date '+%H:%M:%S')] $*"; }

curl_json() {
  local method="$1" url="$2" data="${3:-}"
  local args=(-s -o /dev/null -w "%{http_code} %{time_total}" -m "$TIMEOUT" -X "$method" "${CURL_AUTH_ARGS[@]}" -H "Content-Type: application/json" "$url")
  if [ -n "$data" ]; then
    args+=(-d "$data")
  fi
  curl "${args[@]}" 2>/dev/null || echo "000 0.000"
}

# ================== FASE 1: HEALTH CHECK ==================
log "==> Health check su ${BASE_URL}/health"
HEALTH_OUT=$(curl -s -o /dev/null -w "%{http_code}" -m "$TIMEOUT" "${CURL_AUTH_ARGS[@]}" "${BASE_URL}/health" 2>/dev/null || echo "000")
if [ "$HEALTH_OUT" != "200" ]; then
  log "ATTENZIONE: /health ha risposto ${HEALTH_OUT} (continuo comunque)"
else
  log "Health OK (200)"
fi

# ================== FASE 2: SETUP - CREA CONTO DI TEST ==================
log "==> Creo un conto di test per il load test"
ACCOUNT_PAYLOAD='{"name":"LoadTest Account","type":"Conto Corrente","color":"#1E40AF"}'
ACCOUNT_RESP=$(curl -s -m "$TIMEOUT" -X POST "${CURL_AUTH_ARGS[@]}" -H "Content-Type: application/json" -d "$ACCOUNT_PAYLOAD" "${BASE_URL}/accounts" 2>/dev/null || echo "")
ACCOUNT_ID=$(echo "$ACCOUNT_RESP" | grep -oE '"id"[[:space:]]*:[[:space:]]*"[^"]+"' | head -1 | sed -E 's/.*"id"[[:space:]]*:[[:space:]]*"([^"]+)".*/\1/')

if [ -z "$ACCOUNT_ID" ]; then
  log "ATTENZIONE: impossibile estrarre accountId, procedo senza accountId (${ACCOUNT_RESP})"
fi
log "Account di test: ${ACCOUNT_ID:-<nessuno>}"

# ================== FASE 3: WRITE LOAD TEST (POST /transactions) ==================
write_worker() {
  set +e
  local worker_id="$1"
  local outfile="${RESULT_DIR}/write_${worker_id}.log"
  : > "$outfile"
  local i
  for ((i=1; i<=REQUESTS_PER_WORKER; i++)); do
    local type="expense"
    (( RANDOM % 2 == 0 )) || type="income"
    local category="${CATEGORIES[$((RANDOM % ${#CATEGORIES[@]}))]}"
    local amount=$(( (RANDOM % 50000) + 100 ))
    local acc_field=""
    if [ -n "$ACCOUNT_ID" ]; then acc_field=",\"accountId\":\"${ACCOUNT_ID}\""; fi
    local mm
    mm=$(printf '%02d' "$MONTH")
    local payload="{\"type\":\"${type}\",\"amount\":${amount},\"category\":\"${category}\",\"date\":\"${YEAR}-${mm}-01\"${acc_field}}"
    local result
    result=$(curl_json POST "${BASE_URL}/transactions" "$payload")
    echo "$result" >> "$outfile"
  done
  exit 0
}

log "==> WRITE load test: ${CONCURRENCY} worker x ${REQUESTS_PER_WORKER} richieste POST /transactions"
pids=()
for w in $(seq 1 "$CONCURRENCY"); do
  write_worker "$w" &
  pids+=($!)
done
for pid in "${pids[@]}"; do
  wait "$pid" 2>/dev/null
done
log "WRITE load test completato."

# ================== FASE 4: READ LOAD TEST (GET endpoints) ==================
read_worker() {
  set +e
  local worker_id="$1"
  local outfile="${RESULT_DIR}/read_${worker_id}.log"
  : > "$outfile"
  local endpoints=(
    "${BASE_URL}/transactions?year=${YEAR}&month=${MONTH}"
    "${BASE_URL}/summary/month?year=${YEAR}&month=${MONTH}"
    "${BASE_URL}/summary/year?year=${YEAR}"
    "${BASE_URL}/accounts"
    "${BASE_URL}/accounts/wealth"
    "${BASE_URL}/accounts/types"
  )
  local i
  for ((i=1; i<=REQUESTS_PER_WORKER; i++)); do
    local url="${endpoints[$((RANDOM % ${#endpoints[@]}))]}"
    local result
    result=$(curl -s -o /dev/null -w "%{http_code} %{time_total}" -m "$TIMEOUT" -X GET "${CURL_AUTH_ARGS[@]}" "$url" 2>/dev/null || echo "000 0.000")
    echo "$result" >> "$outfile"
  done
  exit 0
}

log "==> READ load test: ${CONCURRENCY} worker x ${REQUESTS_PER_WORKER} richieste GET (mix endpoints)"
pids=()
for w in $(seq 1 "$CONCURRENCY"); do
  read_worker "$w" &
  pids+=($!)
done
for pid in "${pids[@]}"; do
  wait "$pid" 2>/dev/null
done
log "READ load test completato."

# ================== FASE 5: CLEANUP - RIMUOVI CONTO DI TEST ==================
if [ -n "$ACCOUNT_ID" ]; then
  log "==> Rimuovo conto di test (cascata su saldi)"
  curl -s -o /dev/null -m "$TIMEOUT" -X DELETE "${CURL_AUTH_ARGS[@]}" "${BASE_URL}/accounts/${ACCOUNT_ID}" || true
fi

# ================== FASE 6: REPORT AGGREGATO ==================
analyze() {
  local label="$1"; shift
  local files=("$@")
  cat "${files[@]}" 2>/dev/null | awk -v label="$label" '
    {
      code=$1; t=$2;
      total++; sum+=t;
      if (total==1 || t<min) min=t;
      if (t>max) max=t;
      if (code ~ /^2/) ok++; else ko++;
      times[total]=t;
    }
    END {
      if (total==0) { print label": nessun dato"; exit }
      n=asort(times);
      p50=times[int(n*0.5)+1];
      p95=times[int(n*0.95)+1];
      p99=times[int(n*0.99)+1];
      printf "%s -> tot=%d ok=%d ko=%d avg=%.3fs min=%.3fs max=%.3fs p50=%.3fs p95=%.3fs p99=%.3fs\n",
        label, total, ok, ko, sum/total, min, max, p50, p95, p99;
    }'
}

echo ""
echo "================= REPORT LOAD TEST ================="
echo "Base URL        : ${BASE_URL}"
echo "Concorrenza     : ${CONCURRENCY} worker"
echo "Richieste/worker: ${REQUESTS_PER_WORKER}"
echo "------------------------------------------------------"
analyze "WRITE (POST /transactions)" "${RESULT_DIR}"/write_*.log
analyze "READ  (GET vari endpoint)" "${RESULT_DIR}"/read_*.log
echo "======================================================"

rm -rf "$RESULT_DIR"
log "Fatto."
