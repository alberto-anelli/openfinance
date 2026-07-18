# SPEC.md — Applicazione "Finance"

## 1. Scopo e contesto
Applicazione web **personale, single-user, senza autenticazione** per la gestione di
entrate e uscite mensili, con riepiloghi mensili e annuali.

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
  └── Repository (interfaccia) → InMemoryRepository (dump/restore su filesystem)
```

**Vincoli chiave:**
- Il frontend è un **artefatto statico** copiato sotto `/var/www/html/content/finance/`, con entry point `app.html`.
- La persistenza vive in un **processo Node persistente** separato, esposto sotto `/content/finance/api/` via reverse proxy.
- Il database è **disaccoppiato dietro un'interfaccia**: l'implementazione attuale è in-memory con dump su file, sostituibile in futuro senza toccare la logica applicativa.

---

## 3. Modello dati

```ts
export interface Transaction {
  id: string;            // uuid v4
  type: 'expense' | 'income';
  amount: number;        // interi in CENTESIMI (>0) — evitare float
  category: string;      // libera (expense) | enum (income)
  date: string;          // 'YYYY-MM-DD'
  createdAt: string;     // ISO datetime
}
```

### 3.1 Regole di validazione
| Campo | Regola |
|---|---|
| `amount` | numero > 0, salvato in **centesimi** (intero) |
| `date` (expense) | default oggi; ammesse **oggi e date future** |
| `date` (income) | default oggi; ammesse **oggi e date future** |
| `category` (expense) | stringa libera, `trim`, 1–60 caratteri |
| `category` (income) | enum: `stipendio` \| `tredicesima` \| `quattordicesima` \| `regalo` |
| `type` | `expense` \| `income` |

> Nota implementativa: input/output API usano l'importo in **centesimi**; la formattazione `€` è responsabilità del frontend.

---

## 4. Repository (disaccoppiamento DB)

Le route/API dipendono **solo** dall'interfaccia, ottenuta via factory/singleton.

```ts
export interface Repository {
  add(tx: Omit<Transaction,'id'|'createdAt'>): Promise<Transaction>;
  update(id: string, patch: Partial<Transaction>): Promise<Transaction>;
  delete(id: string): Promise<void>;
  list(filter?: { year?: number; month?: number; type?: Transaction['type']; category?: string }): Promise<Transaction[]>;
  getById(id: string): Promise<Transaction | null>;
}
```

### 4.1 `InMemoryRepository` — persistenza
- Dati in `Map<string, Transaction>`.
- **Write-through:** ogni `add/update/delete` innesca una scrittura su file, con **debounce ~1s** per raggruppare scritture ravvicinate.
- **Snapshot periodico:** timer ogni **4h** che salva un dump completo.
- **Scrittura atomica:** scrivere su file temporaneo + `rename` per evitare dump corrotti.
- **Restore all'avvio:** carica `dump-latest.json`; se corrotto, fallback all'ultimo `dump-<ts>.json` valido; se nessuno, parte vuoto.
- **Graceful shutdown:** su `SIGINT`/`SIGTERM` esegue un dump sincrono finale.

### 4.2 Formato dump
```json
{ "schemaVersion": 1, "savedAt": "2026-07-18T10:00:00Z", "transactions": [ /* Transaction[] */ ] }
```
- File principale: `dump-latest.json`.
- Rotazione: `dump-<ISO>.json`, mantenere ultimi `FINANCE_DUMP_KEEP` (default 10).
- Cartella: `FINANCE_DATA_DIR`.

---

## 5. API REST (servizio Node)
Base path proxato: `/content/finance/api`. Risposte JSON.

| Metodo | Endpoint | Descrizione |
|---|---|---|
| `POST`   | `/transactions` | crea (body con `type`) |
| `GET`    | `/transactions?year=&month=&type=&category=` | lista filtrata |
| `GET`    | `/transactions/:id` | dettaglio |
| `PATCH`  | `/transactions/:id` | modifica (opzionale / nice-to-have) |
| `DELETE` | `/transactions/:id` | elimina |
| `GET`    | `/summary/month?year=&month=` | totali mese + differenza |
| `GET`    | `/summary/year?year=` | totali per ciascun mese + gap + totale annuo |
| `GET`    | `/health` | liveness probe |

**Errori:** `{ "error": { "code": string, "message": string } }` con status HTTP coerente (400 validazione, 404 not found, 500 interno).

---

## 6. Funzionalità e pagine (UI)

### 6.1 `/add-notes` — Aggiungi spesa
- Campi: `importo` (numerico, formattazione €), `categoria` (testo libero **+ suggerimenti** via `datalist` dalle categorie già usate), `data` (default oggi, future ammesse).
- Validazione inline, toast di successo, reset o redirect a `/month`.

### 6.2 `/add-entry` — Aggiungi entrata
- Campi: `importo`, `categoria` (**select**: Stipendio, Tredicesima, Quattordicesima, Regalo), `data` (default oggi, future ammesse).
- Stessa UX di conferma.

### 6.3 `/month` — Riepilogo
Struttura verticale:
1. **Selettore mese/anno** con frecce ◀ ▶ (default: mese corrente).
2. **Filtro per categoria** (chips / multi-select) applicato alla lista del mese.
3. **Lista voci del mese** (entrate + uscite): importo, categoria, data, colore semantico, azione **elimina**.
4. **Riepilogo mese (in fondo):** Totale entrate | Totale uscite | **Differenza** (positiva/negativa evidenziata).
5. **Riepilogo anno (compatto):** totale entrate e totale uscite dell'anno corrente sui dati inseriti.
6. **Tabella annuale espandibile** (accordion): una riga per mese con `Entrate | Uscite | Gap`, più riga totale.

### 6.4 Palette e stile
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
| `FINANCE_DATA_DIR` | `/var/lib/finance` | cartella dump |
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

---

## 9. Requisiti non funzionali
- **Idempotenza deploy:** rieseguibile senza corrompere i dati.
- **Backup/restore:** i file in `FINANCE_DATA_DIR` sono il punto di backup. Restore manuale: copiare un `dump-<ts>.json` su `dump-latest.json` e riavviare il servizio.
- **Log:** stdout/stderr → journald.
- **Robustezza:** dump con scrittura atomica; restore con fallback su dump precedente se corrotto.
- **Test minimi:** unit su `InMemoryRepository` (dump/restore, calcolo summary) e sulla validazione input.

---

## 10. Struttura repository
```
finance/
├─ src/
│  ├─ routes/
│  │  ├─ add-notes/     (+page.svelte)
│  │  ├─ add-entry/     (+page.svelte)
│  │  ├─ month/         (+page.svelte)
│  │  └─ +layout.svelte
│  ├─ lib/
│  │  ├─ components/     (Button, AmountInput, DatePicker, Card, SummaryTable...)
│  │  ├─ theme.css
│  │  ├─ api/            (client fetch → PUBLIC_API_BASE)
│  │  └─ server/repository/
│  │     ├─ Repository.ts
│  │     ├─ InMemoryRepository.ts
│  │     └─ dump.ts
├─ scripts/deploy-frontend.sh
├─ svelte.config.js
├─ package.json
└─ SPEC.md
```

---

## 11. Criteri di accettazione
- [ ] `/add-notes` crea una spesa con categoria libera e data (oggi/future).
- [ ] `/add-entry` crea un'entrata con categoria da enum e data (oggi/future).
- [ ] `/month` mostra lista mensile filtrabile per categoria, con differenza entrate/uscite.
- [ ] `/month` mostra totali annui compatti + tabella espandibile mese-per-mese con gap.
- [ ] Palette blu/arancione/grigio applicata con contrasto AA.
- [ ] Dump automatico ogni 4h + write-through + restore all'avvio funzionanti.
- [ ] `npm run build` produce l'output statico e lo copia in `/var/www/html/content/finance/` con entry point `app.html`.
- [ ] Il repository è dietro interfaccia e sostituibile senza modificare le route.

