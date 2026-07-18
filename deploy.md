# Deploy — Finance App

## Architettura

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

---

## Prerequisiti

- Node.js 22+
- npm
- sudo (per deploy statico e systemd)
- Web server (Nginx/Apache) con reverse proxy configurato

---

## 1. Backend — Build & Avvio

```bash
cd backend

# Installa dipendenze
npm ci

# Build TypeScript
npm run build

# Crea directory dati (una tantum)
sudo mkdir -p /var/lib/finance
sudo chown www-data:www-data /var/lib/finance

# Installa e avvia servizio systemd (una tantum)
sudo cp finance-api.service /etc/systemd/system/finance-api.service
sudo systemctl daemon-reload
sudo systemctl enable --now finance-api

# Log
sudo journalctl -u finance-api -f
```

### Variabili d'ambiente

| Variabile | Default | Descrizione |
|---|---|---|
| `FINANCE_PORT` | `3900` | Porta del servizio Node |
| `FINANCE_DATA_DIR` | `/var/lib/finance` | Directory dei dump |
| `FINANCE_DUMP_INTERVAL_MS` | `14400000` (4h) | Intervallo snapshot periodico |
| `FINANCE_DUMP_KEEP` | `10` | Numero di dump ruotati da mantenere |

---

## 2. Frontend — Build & Deploy

```bash
# Dalla root del progetto

# Installa dipendenze
npm ci

# Build frontend statico
npm run build:app

# Deploy su web server (richiede sudo)
sudo bash scripts/deploy-frontend.sh
```

Lo script `scripts/deploy-frontend.sh` copia il contenuto di `build/` in `/var/www/html/content/finance/` con `rsync --delete`, impostando i permessi corretti per `www-data`.

### Output build

```
build/
  app.html              ← fallback / entry point SPA
  _app/immutable/...    ← asset compilati
```

---

## 3. Servizio systemd

File: `/etc/systemd/system/finance-api.service`

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

**Copiare il backend in `/opt/finance-api`:**

```bash
sudo cp -r backend/* /opt/finance-api/
sudo chown -R www-data:www-data /opt/finance-api
```

---

## 4. Reverse proxy — Nginx

```nginx
# API → reverse proxy verso il backend Node
location /content/finance/api/ {
    proxy_pass http://127.0.0.1:3900/api/;
    proxy_set_header Host $host;
}

# Statico → fallback SPA
location /content/finance/ {
    try_files $uri $uri/ /content/finance/app.html;
}
```

Ricarica Nginx dopo aver configurato:

```bash
sudo nginx -t && sudo systemctl reload nginx
```

---

## 5. Procedura completa (prima volta)

```bash
# 1. Dipendenze
cd backend && npm ci && cd ..
npm ci

# 2. Build backend + frontend
cd backend && npm run build && cd ..
npm run build        # build:app + deploy statico

# 3. Backend service
sudo mkdir -p /var/lib/finance
sudo chown www-data:www-data /var/lib/finance
sudo cp backend/finance-api.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now finance-api

# 4. Ricarica web server
sudo nginx -t && sudo systemctl reload nginx
```

---

## 6. Backup & Restore

### Backup
I file in `FINANCE_DATA_DIR` (`/var/lib/finance/`) sono il punto di backup. Copiare l'intera directory:

```bash
cp -r /var/lib/finance /var/lib/finance-backup-$(date +%Y%m%d)
```

### Restore
```bash
# Fermare il servizio
sudo systemctl stop finance-api

# Copiare un dump precedente come dump-latest.json
cp /var/lib/finance-backup-20260718/dump-2026-07-18T09-00-00.json /var/lib/finance/dump-latest.json

# Riavviare
sudo systemctl start finance-api
```

---

## 7. Manutenzione

### Idempotenza
Il deploy è rieseguibile senza corrompere i dati: lo script `deploy-frontend.sh` aggiorna solo i file statici, mentre i dump persistono in `FINANCE_DATA_DIR`.

### Log
Il backend scrive su stdout/stderr → journald:

```bash
sudo journalctl -u finance-api -f
```

### Riavvio servizio
```bash
sudo systemctl restart finance-api
```