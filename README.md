# Arrocco

Un client moderno e self-hostabile per [Lichess](https://lichess.org).

Arrocco è una single-page application che parla **direttamente** con le API pubbliche di
Lichess. Non c'è nessun backend, nessun database e nessun segreto da custodire: il self-hosting
consiste nel copiare una cartella di file statici su un web server qualsiasi. Lo stesso bundle
alimenta anche l'applicazione desktop.

---

## Funzionalità (v1)

| Sezione       | Cosa fa                                                                                                                 |
| ------------- | ----------------------------------------------------------------------------------------------------------------------- |
| **Home**      | Messaggio di benvenuto in rotazione, heatmap a quadratini per partite e puzzle, streak corrente e record, win rate, ultime 5 partite |
| **Gioca**     | Partite contro Stockfish (livelli 1–8) e ricerca di un avversario umano nella lobby di Lichess; ripresa delle partite in corso |
| **Partita**   | Scacchiera Chessground, orologi con countdown fluido, lista mosse, promozione, offerta di patta, abbandono, premosse     |
| **Puzzle**    | Puzzle dal database Lichess con cinque livelli di difficoltà, validazione mossa per mossa, risposte automatiche dell'avversario, registrazione del risultato sull'account |
| **Amici**     | I giocatori che segui, con presenza in tempo reale (online, in partita con la cadenza, in diretta); scheda profilo con rating, bilancio e testa a testa contro di te |
| **Archivio**  | Storico completo paginato, con filtri per esito e cadenza                                                                |
| **Risorse**   | Struttura predisposta; i contenuti arriveranno in una versione successiva                                                |

Tema chiaro/scuro/sistema, sidebar comprimibile, layout responsive.

---

## Requisiti

- **Node.js 20+** (sviluppato con 22.16)
- Per la versione desktop: **Rust 1.77.2+** e i prerequisiti di sistema di
  [Tauri v2](https://v2.tauri.app/start/prerequisites/)

---

## Sviluppo

```bash
npm install
```

```bash
npm run dev
```

L'app è su `http://localhost:5173`. Altri comandi utili:

```bash
npm run typecheck
```

```bash
npm run build
```

---

## Self-hosting

Compila:

```bash
npm run build
```

Poi servi il contenuto di `dist/` con qualsiasi web server statico. **Non serve nessuna
configurazione**: Arrocco usa hash routing (`/#/puzzle`) e percorsi asset relativi, quindi
funziona anche da una sottocartella arbitraria senza regole di rewrite.

Prova rapida in locale:

```bash
npm run preview
```

### Esempi

**Caddy** — l'intera configurazione:

```
scacchi.esempio.it {
	root * /var/www/arrocco
	file_server
}
```

**nginx**:

```nginx
server {
	listen 80;
	server_name scacchi.esempio.it;
	root /var/www/arrocco;
	index index.html;
}
```

**Sottocartella** (es. `https://casa.mia/arrocco/`): copia `dist/` in
`/var/www/html/arrocco/` e non modificare nulla. Funziona così com'è.

**Docker** — nessun Dockerfile è incluso perché sarebbe superfluo:

```bash
docker run -d -p 8080:80 -v "$(pwd)/dist:/usr/share/nginx/html:ro" nginx:alpine
```

### Una nota su HTTPS

Il login OAuth richiede un contesto sicuro, perché usa `crypto.subtle` per calcolare il
challenge PKCE. `localhost` è considerato sicuro dai browser, quindi lo sviluppo funziona
in HTTP; **un'installazione raggiungibile da rete deve però stare su HTTPS**, altrimenti
il pulsante di accesso non funzionerà.

---

## Versione desktop

Il progetto include lo scaffold [Tauri v2](https://v2.tauri.app/) in `src-tauri/`.

> **Stato:** la configurazione desktop è scritta ma **non è stata compilata né provata**,
> perché la macchina su cui Arrocco è stato sviluppato non aveva il toolchain Rust
> installato. Il codice web è invece verificato e funzionante. Aspettati di dover
> sistemare qualche dettaglio al primo `tauri dev`.

Una volta installato Rust, genera le icone per tutte le piattaforme partendo da quella
sorgente versionata:

```bash
npm run tauri:icons
```

Poi:

```bash
npm run tauri:dev
```

```bash
npm run tauri:build
```

### Perché il login desktop è diverso

Su desktop non esiste un URL http a cui Lichess possa rimandare l'utente: la webview non è
raggiungibile dall'esterno. Arrocco quindi:

1. apre la pagina di consenso nel **browser di sistema** (così l'utente vede il vero dominio
   `lichess.org` prima di autorizzare, e riusa la sessione che ha già);
2. riceve il codice tramite lo **schema custom** `arrocco://oauth`, registrato presso il
   sistema operativo;
3. usa `tauri-plugin-single-instance` perché il deep link raggiunga la finestra già aperta
   invece di avviare una seconda copia dell'app.

---

## Come funziona l'autenticazione

Arrocco usa **OAuth2 Authorization Code + PKCE**. Lichess non richiede la registrazione
dell'applicazione né un client secret per i client pubblici, ed è ciò che rende possibile una
app senza backend:

- il token viene salvato **solo** in `localStorage`, su quel dispositivo;
- nessun dato transita da server terzi — le richieste vanno da te a `lichess.org`;
- il logout revoca il token anche lato Lichess;
- gli scope richiesti sono il minimo necessario:

| Scope             | Serve per                                       |
| ----------------- | ----------------------------------------------- |
| `board:play`      | giocare le partite                              |
| `challenge:write` | creare partite contro Stockfish                 |
| `puzzle:read`     | leggere lo storico puzzle (per la heatmap)      |
| `puzzle:write`    | registrare i puzzle risolti                     |
| `preference:read` | leggere le preferenze dell'account              |
| `follow:read`     | leggere l'elenco dei giocatori che segui        |

`email:read` e ogni permesso di scrittura sull'account sono deliberatamente esclusi — incluso
`follow:write`: la sezione Amici è di sola lettura, seguire e bloccare restano azioni da fare
su Lichess.

---

## Scelte tecniche

**Nessun backend.** Il CORS di Lichess è aperto e accetta l'header `Authorization`, quindi il
browser può parlare direttamente con l'API. Un proxy non aggiungerebbe nulla e sarebbe una
cosa in più da mantenere e da mettere in sicurezza.

**Rispetto dei rate limit.** Le richieste passano da un limiter con due corsie: concorrenza 2
per le chiamate normali, concorrenza 1 per gli endpoint che rifiutano richieste sovrapposte
(`/api/games/user/…` risponde 429 se ne arrivano due insieme). Ricevuto un 429, un cooldown
*globale* mette in pausa tutto e la UI lo comunica invece di insistere. Lo slot viene rilasciato
appena arrivano gli header, così uno stream long-lived — la partita in corso, lo stream eventi —
non blocca il resto dell'app.

**Hash routing.** Il costo è un URL meno elegante. Il vantaggio è che qualsiasi server statico
serve l'app senza configurazione, che è precisamente l'obiettivo del progetto.

**La posizione arriva sempre dal server.** Lo stream della Board API invia l'elenco completo
delle mosse a ogni aggiornamento, non un delta: Arrocco ricostruisce la posizione da zero ogni
volta. Un evento perso non desincronizza nulla. Se il server rifiuta una mossa che Chessground
ha già mostrato localmente, la scacchiera viene riportata allo stato autorevole.

**Analisi su Lichess.** Non riscriviamo la scacchiera di analisi: le partite si aprono su
Lichess, che lo fa già molto meglio.

### Struttura

```
src/
├── lib/
│   ├── lichess/     client HTTP, limiter, parser ndjson, tipi, endpoint
│   ├── auth/        flusso PKCE e store della sessione
│   ├── chess/       ponte fra chess.js (regole) e Chessground (rendering)
│   ├── stats/       aggregazione per giorno, streak, win rate
│   ├── social/      unione fra profili seguiti e presenza in tempo reale
│   └── hooks/       partita live, ricerca avversario, trainer puzzle, amici
├── components/
│   ├── layout/      shell, sidebar, navigazione
│   ├── chess/       scacchiera, orologio, lista mosse, promozione
│   ├── social/      lista amici e scheda profilo
│   └── ui/          primitive del design system
└── routes/          una pagina per sezione
```

---

## Licenza

**GPL-3.0-or-later.**

Arrocco usa [Chessground](https://github.com/lichess-org/chessground), la scacchiera di
Lichess, distribuita sotto GPL-3.0. È una licenza virale, quindi Arrocco lo è a sua volta —
una scelta coerente per un client di un progetto libero.

## Riconoscimenti

- [Lichess](https://lichess.org) per il server di scacchi libero e per API pubbliche di
  qualità raramente vista
- [Chessground](https://github.com/lichess-org/chessground) — scacchiera (GPL-3.0)
- [chess.js](https://github.com/jhlywa/chess.js) — regole del gioco (BSD-2-Clause)
- Pezzi [Colin M.L. Burnett](https://en.wikipedia.org/wiki/User:Cburnett) (CC BY-SA 3.0)

Arrocco non è affiliato a Lichess.
