# SPEC.md — Applicazione "Finance"

## 1. Scopo e contesto
Applicazione web **personale, single-user, senza autenticazione** per la gestione di
entrate e uscite mensili, con riepiloghi mensili e annuali, gestione di conti/patrimonio
e associazione di ogni transazione a un conto.

- **Stack:** SvelteKit (frontend statico) + micro-servizio Node di persistenza.
- **Valuta:** EUR, formattazione locale `it-IT` (es. `1.234,56 €`).
- **UI:** semplice e intuitiva, palette **blu / arancione / grigio** con sfumature.

---

## 2. Architettura (scenario "Hybrid" — confermato)

```
Browser (SPA statica SvelteKit)
        │  fetch JSON
        ▼
Web server esistente (Nginx/Apache)
  ├── statico:        /content/finance/**       → /var/www/html/content/finance/
  └── reverse proxy:  /content/finance/api/**    → http://127.0.0.1:PORT/api/**
        ▼
Servizio Node "finance-api" (systemd)
  ├── Repository (interfaccia) → InMemoryRepository (dump/restore su filesystem)
  └── AccountRepository (persistenza conti + saldi su filesystem)
```

**Vincoli chiave:**
- Il frontend è un **artefatto statico** copiato sotto `/var/www/html/content/finance/`, con entry point `app.html`.
- La persistenza vive in un **processo Node persistente** separato, esposto sotto `/content/finance/api/` via reverse proxy.
- I database (transazioni e conti) sono **disaccoppiati dietro interfacce** separate, sostituibili in futuro senza toccare la logica applicativa.

---

## 3. Modello dati

### 3.1 Transaction (entrate/uscite)

```ts
export interface Transaction {
  id: string;            // uuid v4
  type: 'expense' | 'income';
  amount: number;        // interi in CENTESIMI (>0) — evitare float
  category: string;      // libera, free-text (sia expense che income)
  description?: string;  // opzionale, solo expense
  date: string;          // 'YYYY-MM-DD'
  createdAt: string;     // ISO datetime
  accountId?: string;    // riferimento a un conto (opzionale)
}
```

### 3.2 Account (conti)

```ts
export type AccountType = string;  // free-text, es. "Conto Corrente", "Contanti", "Carta"

export interface Account {
  id: string;
  name: string;
  type: AccountType;     // libero, con suggerimenti da tipi già usati
  currency: string;      // default "EUR"
  color: string;         // hex #RRGGBB per identificazione visiva
  createdAt: string;
  updatedAt: string;
}

export interface AccountBalanceLog {
  id: string;
  accountId: string;
  balance: number;       // centesimi
  date: string;          // YYYY-MM-DD
  note?: string;
  createdAt: string;
}
```

### 3.3 Regole di validazione

| Campo | Regola |
|---|---|
| `amount` | numero > 0, salvato in **centesimi** (intero) |
| `date` | default oggi; ammesse **oggi e date future** |
| `category` | stringa libera, `trim`, 1–60 caratteri (sia expense che income) |
| `type` | `expense` \| `income` |
| `accountId` | opzionale, uuid v4 di un conto esistente |
| `name` (account) | stringa non vuota |
| `type` (account) | stringa non vuota, libera (nessun enum) |
| `color` (account) | hex #RRGGBB, validato |

> Nota: la categoria income non è più un enum. Sia expense che income usano testo libero con suggerimenti.

---

## 4. Repository (disaccoppiamento DB)

### 4.1 Transaction Repository

Le route/API dipendono **solo** dall'interfaccia, ottenuta via factory/singleton.

```ts
export interface Repository {
  add(tx: Omit<Transaction,'id'|'createdAt'>): Promise<Transaction>;
  update(id: string, patch: Partial<Transaction>): Promise<Transaction>;
  delete(id: string): Promise<void>;
  list(filter?: {
    year?: number;
    month?: number;
    type?: Transaction['type'];
    category?: string;
    accountId?: string;
  }): Promise<Transaction[]>;
  getById(id: string): Promise<Transaction | null>;
}
```

### 4.2 `InMemoryRepository` — persistenza transazioni
- Dati in `Map<string, Transaction>`.
- **Write-through:** ogni `add/update/delete` innesca una scrittura su file, con **debounce ~1s** per raggruppare scritture ravvicinate.
- **Snapshot periodico:** timer ogni **4h** che salva un dump completo.
- **Scrittura atomica:** scrivere su file temporaneo + `rename` per evitare dump corrotti.
- **Restore all'avvio:** carica `dump-latest.json`; se corrotto, fallback all'ultimo `dump-<ts>.json` valido; se nessuno, parte vuoto.
- **Graceful shutdown:** su `SIGINT`/`SIGTERM` esegue un dump sincrono finale.

### 4.3 `AccountRepository` — persistenza conti e saldi
- Dati in `Map<string, Account>` + `Map<string, AccountBalanceLog>`.
- **Write-through:** ogni operazione salva su file.
- **Snapshot periodico:** timer ogni **4h** con rotazione.
- **File:** `accounts.json` (dump) + `accounts-<ISO>.json` (snapshot ruotati).
- **Cascata:** eliminando un conto vengono rimossi automaticamente tutti i suoi saldi.

### 4.4 Formato dump transazioni
```json
{ "schemaVersion": 1, "savedAt": "2026-07-18T10:00:00Z", "transactions": [ /* Transaction[] */ ] }
```
- File principale: `dump-latest.json`.
- Rotazione: `dump-<ISO>.json`, mantenere ultimi `FINANCE_DUMP_KEEP` (default 10).
- Cartella: `FINANCE_DATA_DIR`.

### 4.5 Formato dump conti
```json
{ "schemaVersion": 1, "savedAt": "2026-07-20T10:00:00Z", "accounts": [ /* Account[] */ ], "balanceLogs": [ /* AccountBalanceLog[] */ ] }
```
- File principale: `accounts.json`.
- Stessa cartella: `FINANCE_DATA_DIR`.

---

## 5. API REST (servizio Node)
Base path proxato: `/content/finance/api`. Risposte JSON.

### 5.1 Transazioni
| Metodo | Endpoint | Descrizione |
|---|---|---|
| `POST`   | `/transactions` | crea (body con `type`, `accountId` opzionale) |
| `GET`    | `/transactions?year=&month=&type=&category=&accountId=` | lista filtrata |
| `GET`    | `/transactions/:id` | dettaglio |
| `PATCH`  | `/transactions/:id` | modifica (anche `accountId`) |
| `DELETE` | `/transactions/:id` | elimina |

### 5.2 Riepiloghi
| Metodo | Endpoint | Descrizione |
|---|---|---|
| `GET`    | `/summary/month?year=&month=` | totali mese + differenza |
| `GET`    | `/summary/year?year=` | totali per ciascun mese + gap + totale annuo |

### 5.3 Conti
| Metodo | Endpoint | Descrizione |
|---|---|---|
| `GET`    | `/accounts` | lista conti |
| `GET`    | `/accounts/types` | tipi di conto distinti usati (per suggerimenti UI) |
| `GET`    | `/accounts/wealth` | conti con saldo più recente (`latestBalance`) |
| `POST`   | `/accounts` | crea conto (body: `name`, `type`, `color`) |
| `GET`    | `/accounts/:id` | dettaglio conto |
| `PATCH`  | `/accounts/:id` | modifica conto |
| `DELETE` | `/accounts/:id` | elimina conto (cascata: rimuove anche saldi) |

### 5.4 Saldi
| Metodo | Endpoint | Descrizione |
|---|---|---|
| `GET`    | `/accounts/:id/balances` | storico saldi di un conto |
| `POST`   | `/accounts/:id/balances` | registra saldo (body: `balance`, `date`, `note?`) |
| `PATCH`  | `/balances/:id` | modifica registrazione saldo |
| `DELETE` | `/balances/:id` | elimina registrazione saldo |

### 5.5 Health
| Metodo | Endpoint | Descrizione |
|---|---|---|
| `GET`    | `/health` | liveness probe |

**Errori:** `{ "error": { "code": string, "message": string } }` con status HTTP coerente (400 validazione, 404 not found, 500 interno).

---

## 6. Funzionalità e pagine (UI)

### 6.1 `/add-notes` — Aggiungi spesa
- Campi: `importo` (numerico, formattazione €), `categoria` (testo libero **+ suggerimenti** via tag buttons dalle categorie già usate), `conto` (select opzionale dai conti esistenti), `data` (default oggi, future ammesse).
- Validazione inline, toast di successo, reset o redirect a `/month`.

### 6.2 `/add-entry` — Aggiungi entrata
- Campi: `importo`, `categoria` (testo libero, non più enum), `conto` (select opzionale dai conti esistenti), `data` (default oggi, future ammesse).
- Stessa UX di conferma.

### 6.3 `/month` — Riepilogo mensile
Struttura verticale:
1. **Selettore mese/anno** con frecce ◀ ▶ (default: mese corrente).
2. **Filtro per categoria** (chips) applicato alla lista del mese.
3. **Lista voci del mese** (entrate + uscite): importo, categoria, data, **conto associato**, colore semantico, azioni **modifica** ed **elimina**.
4. **Riepilogo mese (in fondo):** Totale entrate | Totale uscite | **Differenza** (positiva/negativa evidenziata).
5. **Riepilogo anno (compatto):** totale entrate e totale uscite dell'anno corrente sui dati inseriti.
6. **Tabella annuale espandibile** (accordion): una riga per mese con `Entrate | Uscite | Gap`, più riga totale.

### 6.4 `/app` — Dashboard (Panoramica)
- **Anno navigabile** con input numerico e frecce ◀ ▶.
- **Statistiche annuali:** entrate, uscite, saldo (differenza).
- **Patrimonio Netto:** totale dei saldi di tutti i conti, con ripartizione per tipo di conto.
- **Grafico a barre mensile** (entrate blu / uscite arancione) — cliccando una barra si scende nel dettaglio mese.
- **Dettaglio mese:** categorie entrate/uscite con barre proporzionali, lista transazioni con **conto associato**.

### 6.5 `/app/account` — Gestione Conti
- **Elenco conti** a griglia con saldo corrente, tipo, colore identificativo.
- **Dettaglio conto:** saldo attuale, grafico evoluzione saldo, variazioni mensili, storico registrazioni.
- **CRUD conti** via modale: nome, tipo (testo libero **+ suggerimenti** da tipi già usati), colore.
- **CRUD saldi** via modale: data, saldo in centesimi, nota opzionale.
- **Sezione Patrimonio:** totale netto, ripartizione per tipo, barra impilata.

### 6.6 Palette e stile
| Ruolo | Colore | Uso |
|---|---|---|
| Primario | **Blu** (`--blue-100…900`) | header, azioni primarie, **entrate** |
| Accento | **Arancione** (`--orange-…`) | CTA secondarie, evidenze, **uscite** |
| Neutro | **Grigio** (`--gray-50…900`) | testo, sfondi, bordi |

- Convenzione semantica coerente ovunque: **entrate = blu**, **uscite = arancione**.
- Contrasto conforme **WCAG AA** (≥ 4.5:1 sul testo).
- Colori come **CSS custom properties** in un unico file tema (`src/lib/theme.css`).
- Responsive **mobile-first**; componenti riutilizzabili (`Button`, `AmountInput`, `DatePicker`, `Card`, `SummaryTable`).

---

## 7. Configurazione (env)
| Variabile | Default | Uso |
|---|---|---|
| `FINANCE_PORT` | `3900` | porta servizio Node |
| `FINANCE_DATA_DIR` | `/var/lib/finance` | cartella dump (transazioni + conti) |
| `FINANCE_DUMP_INTERVAL_MS` | `14400000` | snapshot ogni 4h |
| `FINANCE_DUMP_KEEP` | `10` | file di rotazione |
| `PUBLIC_API_BASE` | `/content/finance/api` | base path API lato frontend |

---

## 8. Build & Deploy

### 8.1 Frontend statico — `svelte.config.js`
```js
import adapter from '@sveltejs/adapter-static';

export default {
  kit: {
    adapter: adapter({ fallback: 'app.html', pages: 'build', assets: 'build' }),
    paths: { base: '/content/finance' }
  }
};
```

### 8.2 Script di deploy (invocato dalla build) — `scripts/deploy-frontend.sh`
```bash
#!/usr/bin/env bash
set -euo pipefail

BUILD_DIR="build"
TARGET_DIR="/var/www/html/content/finance"

echo "==> Deploy frontend statico verso ${TARGET_DIR}"
[ -d "$BUILD_DIR" ] || { echo "ERRORE: build/ mancante. Esegui prima 'npm run build:app'"; exit 1; }

sudo mkdir -p "$TARGET_DIR"
sudo rsync -a --delete "$BUILD_DIR"/ "$TARGET_DIR"/          # sync atomico, rimuove obsoleti
sudo chown -R www-data:www-data "$TARGET_DIR"
sudo find "$TARGET_DIR" -type d -exec chmod 755 {} \;
sudo find "$TARGET_DIR" -type f -exec chmod 644 {} \;

echo "==> Entry point: ${TARGET_DIR}/app.html"
echo "==> Fatto."
```

### 8.3 `package.json`
```json
{
  "scripts": {
    "build:app": "vite build",
    "build": "npm run build:app && bash scripts/deploy-frontend.sh"
  }
}
```

### 8.4 Servizio backend — `/etc/systemd/system/finance-api.service`
```ini
[Unit]
Description=Finance API
After=network.target

[Service]
WorkingDirectory=/opt/finance-api
Environment=FINANCE_PORT=3900
Environment=FINANCE_DATA_DIR=/var/lib/finance
ExecStart=/usr/bin/node build/index.js
Restart=always
User=www-data

[Install]
WantedBy=multi-user.target
```

### 8.5 Reverse proxy — esempio Nginx
```nginx
location /content/finance/api/ {
    proxy_pass http://127.0.0.1:3900/api/;
    proxy_set_header Host $host;
}
location /content/finance/ {
    try_files $uri $uri/ /content/finance/app.html;
}
```

### 8.6 Procedura operativa
```bash
# 1. dipendenze
npm ci

# 2. build frontend + deploy statico (invoca lo script bash)
npm run build

# 3. backend (una tantum)
sudo mkdir -p /var/lib/finance && sudo chown www-data:www-data /var/lib/finance
sudo systemctl enable --now finance-api

# 4. ricarica web server
sudo nginx -t && sudo systemctl reload nginx
```

### 8.7 Deploy incrementale backend
```bash
# Ricostruire e copiare il backend dopo modifiche
cd backend && npm run build && cd ..
sudo cp -r backend/build/* /opt/finance-api/build/
sudo systemctl restart finance-api
```

---

## 9. Requisiti non funzionali
- **Idempotenza deploy:** rieseguibile senza corrompere i dati.
- **Backup/restore:** i file in `FINANCE_DATA_DIR` sono il punto di backup. Includono `dump-latest.json` (transazioni) e `accounts.json` (conti+saldi). Restore manuale: copiare i file precedenti e riavviare il servizio.
- **Log:** stdout/stderr → journald.
- **Robustezza:** dump con scrittura atomica; restore con fallback su dump precedente se corrotto.
- **Test minimi:** unit su `InMemoryRepository` (dump/restore, calcolo summary) e sulla validazione input.

---

## 10. Struttura repository
```
finance/
├─ src/
│  ├─ routes/
│  │  ├─ add-notes/        (+page.svelte)     — aggiungi spesa
│  │  ├─ add-entry/        (+page.svelte)     — aggiungi entrata
│  │  ├─ month/            (+page.svelte)     — riepilogo mensile
│  │  ├─ app/
│  │  │  ├─ +page.svelte                      — dashboard / panoramica
│  │  │  └─ account/
│  │  │     └─ +page.svelte                   — gestione conti e patrimonio
│  │  └─ +layout.svelte
│  ├─ lib/
│  │  ├─ components/        (Button, AmountInput, DatePicker, Card, SummaryTable, Toast...)
│  │  ├─ theme.css
│  │  ├─ api/
│  │  │  └─ client.ts                          — client fetch verso API
│  │  └─ base.ts                               — rilevamento base path dinamico
├─ backend/
│  ├─ src/
│  │  ├─ index.ts                              — entry point Express
│  │  ├─ types.ts                              — modelli dati condivisi
│  │  ├─ validation.ts                         — validazione input
│  │  ├─ Repository.ts                         — interfaccia transazioni
│  │  ├─ InMemoryRepository.ts                 — implementazione transazioni
│  │  ├─ AccountRepository.ts                  — repository conti e saldi
│  │  ├─ dump.ts                               — gestione dump/rotate transazioni
│  │  └─ routes/
│  │     ├─ transactions.ts                    — CRUD transazioni
│  │     ├─ accounts.ts                        — CRUD conti, saldi, wealth, types
│  │     ├─ summary.ts                         — riepiloghi mensili/annuali
│  │     └─ health.ts                          — liveness probe
│  └─ package.json
├─ scripts/deploy-frontend.sh
├─ svelte.config.js
├─ package.json
└─ SPEC.md
```

---

## 11. Criteri di accettazione
- [ ] `/add-notes` crea una spesa con categoria libera, conto opzionale e data (oggi/future).
- [ ] `/add-entry` crea un'entrata con categoria libera (non più enum), conto opzionale.
- [ ] `/month` mostra lista mensile filtrabile per categoria, con conto associato.
- [ ] `/month` mostra totali annui compatti + tabella espandibile mese-per-mese con gap.
- [ ] `/app` mostra dashboard annuale con grafico barre, patrimonio netto e drill-down mensile.
- [ ] `/app/account` gestisce CRUD conti con tipo libero + suggerimenti, saldi, evoluzione.
- [ ] Palette blu/arancione/grigio applicata con contrasto AA.
- [ ] Dump automatico transazioni e conti ogni 4h + write-through + restore all'avvio.
- [ ] `npm run build` produce l'output statico e lo copia in `/var/www/html/content/finance/`.
- [ ] I repository sono dietro interfacce e sostituibili senza modificare le route.