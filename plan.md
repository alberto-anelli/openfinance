# AppuntApp — Analisi e Piano di Implementazione

Basato sull'architettura di **OpenFinance** (repo `/home/alberto/repo/llm/openfinance`),
con le correzioni emerse dalla discussione.

---

## 1. Architettura OpenFinance — Com'è e Perché Funziona

### Stack

```
Browser (SvelteKit SPA) → Nginx → Express 5 (single process)
                                         │
                                    In-Memory Map
                                         │
                                    JSON file dump
```

- **Frontend**: SvelteKit 5 + `@sveltejs/adapter-static` → SPA pura. Mobile-first, CSS custom properties.
- **Backend**: Express 5, TypeScript, ESM. Unico processo, porta 3900.
- **Persistenza**: `Map<string, Transaction>` in memoria. Write-through su file JSON con debounce 1s. Dump atomico (tmp + rename). Snapshot ogni 4h.
- **Auth**: nessuna — app personale.

### Dati correnti

- 1.405 transazioni, ~326 KB dump JSON, 4 anni di dati generati
- L'app è fluida e veloce

---

## 2. Perché la Stessa Architettura Va Bene Anche per l'App Appuntamenti

A seguito della discussione, i punti critici che avevo sollevato vengono ridimensionati:

### Scritture Concorrenti — ✅ Non è un problema

**Correzione**: Le richieste HTTP arrivano a un unico processo Node.js. Node.js è single-threaded (event loop). Quindi:

1. Richiesta A arriva → muta la Map in memoria → fine
2. Richiesta B arriva → muta la Map in memoria → fine
3. Il dump su file è una **serializzazione** della Map, non un "merge" di file concorrenti

Non c'è race condition sulla Map perché l'event loop serializza le mutazioni. Il dump finale contiene lo stato completo della Map al momento del write. Non c'è "sovrascrittura" di dati — se A e B modificano appuntamenti diversi, il dump salva entrambi. Se modificano lo stesso, vale l'ultimo (ultima richiesta che ha mutato).

**Caso particolare: slot occupato**. Se A e B provano a prenotare lo stesso slot (stessa ora, stesso giorno), il secondo vedrà ancora lo slot libero nella Map (perché il primo non ha ancora salvato su file, ma la Map è già stata aggiornata). **Questo è un vero problema di concorrenza** — ma si risolve con un lock ottimistico o un semplice check nella route handler, non serve cambiare persistenza.

### Isolamento — ✅ Non è un problema

**Correzione**: Ogni richiesta legge dalla stessa Map, che è sempre in uno stato consistente. Non c'è "write skew" perché l'event loop non interleave le operazioni. Il dump su file non è un problema di isolamento — è solo un backup.

### Query per Utente — ✅ Non è un problema

**Correzione**: I dati sono già tutti in memoria. Filtrare per `userId` è un `.filter()` O(n) su una Map. Anche con 10.000 appuntamenti (~1 anno di attività), l'operazione è sub-millisecondo su hardware moderno. Non serve un indice.

### Durabilità — ⚠️ Accettabile

**Correzione**: La finestra di perdita dati è di 1s (debounce). Con graceful shutdown (SIGTERM/SIGINT → flush finale), in condizioni normali non si perde nulla. In caso di crash hardware (blackout), si perde al massimo 1s di dati. Per un'app di appuntamenti, è accettabile.

### Scalabilità — ❌ Limite riconosciuto

Non si possono avere due istanze del backend che condividono la stessa directory JSON. Per il volume previsto (30 clienti/giorno, un negozio), un singolo processo basta. Se domani servono 10 negozi, si valuta SQLite o PostgreSQL.

---

## 3. Cosa Va Aggiunto / Cambiato

### 3.1 Autenticazione JWT (aggiunta principale)

**Perché**: l'app openfinance non ha auth. L'app appuntamenti serve:

- **Admin** (negoziante): vede tutto, gestisce dashboard
- **Cliente**: vede solo i propri appuntamenti

**Come**: JWT con `jsonwebtoken` + `bcrypt`. Il token contiene `{ userId, role }`. Il backend lo verifica in un middleware Express. Le route decidono: admin → tutto, cliente → solo `clientId === userId`.

**Librerie**: `jsonwebtoken`, `bcrypt` (o `bcryptjs` per zero dipendenze native)

### 3.2 Modello Dati (nuovo, non si riusa nulla)

**Modello transazioni → Modello appuntamenti**

```typescript
// User
interface User {
  id: string;           // uuid
  name: string;
  email: string;
  phone?: string;
  passwordHash: string;
  role: 'admin' | 'client';
  createdAt: string;    // ISO
}

// Appointment
interface Appointment {
  id: string;           // uuid
  clientId: string;     // ref a User
  clientName: string;   // denormalizzato per lettura veloce
  date: string;         // YYYY-MM-DD
  time: string;         // HH:mm (inizio slot)
  duration: number;     // minuti (es. 30)
  service: string;      // es. "Taglio", "Colore"
  status: 'confirmed' | 'cancelled' | 'completed';
  notes?: string;       // max 500 caratteri
  createdAt: string;    // ISO
  updatedAt: string;    // ISO
}
```

### 3.3 Persistenza (stesso pattern di openfinance)

- **Users**: repository in-memory `Map<string, User>` + dump su file `users.json`
- **Appointments**: repository in-memory `Map<string, Appointment>` + dump su file `appointments.json`
- Stesso pattern: atomico (tmp + rename), debounce 1s sulle scritture, snapshot periodico
- Stessa interfaccia `Repository<T>` con metodi `list()`, `getById()`, `create()`, `update()`, `delete()`

### 3.4 Controllo Slot Occupato (lock ottimistico)

Per evitare che due clienti prenotino lo stesso orario:

```typescript
// Route handler POST /api/appointments
function createAppointment(req, res) {
  const { date, time, duration } = req.body;
  
  // Check: esiste già un appuntamento per questa data/ora?
  const existing = appointmentRepo.list().find(a =>
    a.date === date && a.time === time && a.status !== 'cancelled'
  );
  
  if (existing) {
    return res.status(409).json({
      error: { code: 'SLOT_TAKEN', message: 'Orario non disponibile' }
    });
  }
  
  // Crea
  const appointment = { ...req.body, id: uuid(), clientId: req.userId, ... };
  appointmentRepo.create(appointment);
  res.status(201).json(appointment);
}
```

**Nota**: c'è una race condition teorica. Per risolverla davvero servirebbe un lock a livello di OS (file lock) o un DB. Per 30 clienti/giorno, la probabilità di collisione è bassissima. Se diventa un problema, si aggiunge un file `.lock` sul backend.

---

## 4. Cosa si Riutilizza da OpenFinance

| Cosa | Dove | Come |
|---|---|---|
| SvelteKit + adapter-static | `svelte.config.js` | Copia identica |
| Componenti UI | `src/lib/components/` | Button, Card, Toast, DatePicker, SummaryTable |
| CSS theme | `src/lib/theme.css` | Struttura identica, palette da cambiare |
| API client | `src/lib/api/client.ts` | Pattern identico, URL diversi |
| Formattazione | `src/lib/format.ts` | Template per formattazione date |
| Pattern repository backend | `backend/src/Repository.ts` | Interfaccia identica |
| DumpManager | `backend/src/dump.ts` | Stesso pattern (tmp+rename, debounce, snapshot) |
| Validazione | `backend/src/validation.ts` | Pattern da replicare |
| Struttura router | `backend/src/routes/` | Stessa organizzazione |
| Deploy systemd + nginx | `deploy.md` | Stesso pattern, percorsi diversi |

---

## 5. Struttura del Nuovo Repo

```
appuntapp/
├── src/                          # SvelteKit frontend
│   ├── app.html
│   ├── routes/
│   │   ├── +layout.svelte        # Nav + auth check
│   │   ├── +page.svelte          # Landing page / login redirect
│   │   ├── login/+page.svelte    # Login
│   │   ├── register/+page.svelte # Registrazione cliente
│   │   ├── dashboard/            # Admin: riepilogo appuntamenti
│   │   │   └── +page.svelte
│   │   ├── appointments/         # CRUD appuntamenti
│   │   │   ├── +page.svelte      # Lista (admin: tutti, client: propri)
│   │   │   ├── new/+page.svelte  # Nuovo appuntamento
│   │   │   └── [id]/+page.svelte # Dettaglio / modifica
│   │   └── admin/
│   │       └── users/+page.svelte # Gestione utenti (admin)
│   └── lib/
│       ├── api/client.ts         # API client (copiato e adattato)
│       ├── auth.ts               # Store JWT, login/logout
│       ├── format.ts             # Formattazione date
│       ├── theme.css             # CSS custom properties
│       └── components/
│           ├── Button.svelte
│           ├── Card.svelte
│           ├── Toast.svelte
│           ├── AppointmentCard.svelte
│           └── CalendarHeader.svelte
├── backend/
│   └── src/
│       ├── index.ts              # Entry point + middleware auth
│       ├── types.ts              # User, Appointment
│       ├── validation.ts         # Validazione input
│       ├── auth.ts               # JWT sign/verify + password hash
│       ├── Repository.ts         # Interfaccia repository
│       ├── UserRepository.ts     # UserRepo + dump
│       ├── AppointmentRepository.ts # ApptRepo + dump
│       ├── dump.ts               # DumpManager (copiato)
│       ├── authMiddleware.ts     # JWT verify middleware
│       └── routes/
│           ├── auth.ts           # POST /api/auth/register, /api/auth/login
│           ├── appointments.ts   # CRUD appuntamenti
│           └── users.ts          # GET /api/users (admin)
├── scripts/
│   ├── deploy-backend.sh
│   └── deploy-frontend.sh
├── package.json
├── svelte.config.js
├── vite.config.ts
├── tsconfig.json
├── SPEC.md
├── deploy.md
└── plan.md
```

---

## 6. API Surface

```
POST   /api/auth/register          # Registrazione cliente
POST   /api/auth/login             # Login (admin + client) → JWT
GET    /api/auth/me                # Profilo utente corrente

GET    /api/appointments           # Admin: tutti; Client: propri
POST   /api/appointments           # Crea (client)
GET    /api/appointments/:id       # Dettaglio (proprietà o admin)
PATCH  /api/appointments/:id       # Modifica (proprietà o admin)
DELETE /api/appointments/:id       # Cancella (proprietà o admin)

GET    /api/admin/users            # Lista utenti (admin)
```

---

## 7. Frontend — Pagine

| Pagina | Route | Auth | Descrizione |
|---|---|---|---|
| Login | `/login` | No | Form email + password → JWT |
| Registrazione | `/register` | No | Form nome, email, telefono, password |
| Dashboard | `/dashboard` | Admin | Riepilogo appuntamenti di oggi, prossimi, stato |
| I miei appuntamenti | `/appointments` | Client | Lista dei propri appuntamenti |
| Nuovo appuntamento | `/appointments/new` | Client | Form data/ora/servizio |
| Dettaglio appuntamento | `/appointments/:id` | Client | Vista, modifica, cancellazione |
| Gestione utenti | `/admin/users` | Admin | Lista clienti registrati |

---

## 8. Piano di Implementazione

### Step 1: Setup progetto (1h)
- Creare repo separato `appuntapp/`
- Copiare struttura base da openfinance (package.json, svelte.config.js, vite.config.ts, tsconfig.json)
- Installare dipendenze: `better-sqlite3` (solo se si decide per SQLite), `jsonwebtoken`, `bcryptjs`
- Configurare backend Express con porta 3901

### Step 2: Backend — Auth (2-3h)
- `types.ts`: definire User e Appointment
- `auth.ts`: funzioni `hashPassword`, `verifyPassword`, `signToken`, `verifyToken`
- `UserRepository.ts`: in-memory Map + dump su file
- `authMiddleware.ts`: middleware Express che verifica JWT e popola `req.user`
- `routes/auth.ts`: `POST /api/auth/register` e `POST /api/auth/login`
- `index.ts`: montare middleware auth globale (tranne su `/api/auth/`)

### Step 3: Backend — Appuntamenti CRUD (2-3h)
- `AppointmentRepository.ts`: in-memory Map + dump su file
- `routes/appointments.ts`: CRUD completo con autorizzazione
  - `GET /api/appointments`: se admin → tutti, se client → `{clientId: userId}`
  - `POST /api/appointments`: crea, check slot occupato
  - `GET /api/appointments/:id`: verifica proprietà
  - `PATCH /api/appointments/:id`: verifica proprietà
  - `DELETE /api/appointments/:id`: verifica proprietà
- `routes/users.ts`: `GET /api/users` (solo admin)
- `validation.ts`: validazione input appuntamenti

### Step 4: Frontend — Auth (2h)
- `src/lib/api/client.ts`: adattare API client con header `Authorization: Bearer <token>`
- `src/lib/auth.ts`: store JWT in `localStorage`, funzioni `login`, `logout`, `getToken`
- `src/routes/login/+page.svelte`: form login
- `src/routes/register/+page.svelte`: form registrazione
- `src/routes/+layout.svelte`: nav condizionale (admin vs client), protezione route

### Step 5: Frontend — Appuntamenti (3-4h)
- `src/routes/appointments/+page.svelte`: lista appuntamenti (admin: tutti, client: propri)
- `src/routes/appointments/new/+page.svelte`: form prenotazione
- `src/routes/appointments/[id]/+page.svelte`: dettaglio + modifica + cancella
- `src/routes/dashboard/+page.svelte`: dashboard admin (riepilogo, appuntamenti oggi)
- `src/lib/components/AppointmentCard.svelte`: card appuntamento riutilizzabile

### Step 6: Styling e UI (2h)
- `theme.css`: palette colori per il negozio (es. verde/teal o tonalità calde)
- Adattare componenti esistenti (Button, Card, Toast, DatePicker)
- Mobile-first come openfinance

### Step 7: Deploy (1h)
- Script deploy backend (rsync + systemd)
- Script deploy frontend (vite build + rsync)
- Config nginx (reverse proxy `/api/` → backend, static fallback per SPA)
- Variabili ambiente: `PORT`, `DATA_DIR`, `JWT_SECRET`, `DUMP_INTERVAL`, `DUMP_KEEP`

---

## 9. Schema Dati Dettagliato

### Appointment

```typescript
interface Appointment {
  id: string;                    // uuid v4
  clientId: string;              // riferimento a User.id
  clientName: string;            // denormalizzato (nome del cliente al momento)
  date: string;                  // YYYY-MM-DD
  time: string;                  // HH:mm (inizio slot, es. "14:30")
  duration: number;              // minuti (es. 30, 60)
  service: string;               // tipo servizio, es. "Taglio", "Colore"
  status: 'confirmed' | 'cancelled' | 'completed';
  notes: string | null;          // note opzionali (max 500)
  createdAt: string;             // ISO 8601
  updatedAt: string;             // ISO 8601
}
```

### User

```typescript
interface User {
  id: string;                    // uuid v4
  name: string;                  // nome visualizzato
  email: string;                 // usato per login
  phone: string | null;          // telefono opzionale
  passwordHash: string;          // bcrypt hash
  role: 'admin' | 'client';     // ruolo
  createdAt: string;             // ISO 8601
}
```

---

## 10. Variabili Ambiente

```
PORT=3901
DATA_DIR=/var/lib/appuntapp
JWT_SECRET=           # generato al deploy
JWT_EXPIRES_IN=7d     # default
DUMP_INTERVAL_MS=14400000   # 4h
DUMP_KEEP=10
```

---

## 11. Note Aggiuntive

### Perché JWT e non sessioni
- Stateless: il backend non deve tenere stato di sessione
- Semplice: token contiene `userId` e `role`, il middleware legge e decide
- Mobile-friendly: funziona da browser e da eventuale app nativa
- Nessuna dipendenza esterna (Redis, cookie store, ecc.)

### Perché debounce 1s va bene
- 30 clienti/giorno → picco di ~5 richieste/minuto in ora di punta
- Il debounce raggruppa scritture ravvicinate
- Il dato è sempre consistente in memoria
- Il file è solo persistenza, non fonte di verità

### Perché lo slot check è safe (abbastanza)
- La race condition esiste ma è teorica per 30 clienti/giorno
- Soluzione semplice: check + insert nello stesso handler
- Se serve robustezza: si aggiunge `Set` degli slot occupati con lock in memoria

---

## 12. Verifica

1. **`npm run dev`** su frontend e backend → app funzionante in locale
2. **Test flusso completo**: registrazione → login → crea appuntamento → lista → modifica → cancella
3. **Test admin**: login come admin → dashboard → tutti gli appuntamenti
4. **Test isolamento**: login come cliente A → vedo solo i miei appuntamenti
5. **Test slot occupato**: due prenotazioni stesso orario → seconda riceve 409
6. **Test dump**: kill -TERM processo → riavvio → dati recuperati
7. **Deploy**: systemd + nginx → app raggiungibile dal browser