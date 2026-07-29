# Note per lo sviluppo di Arrocco

Client per Lichess: SPA React + TypeScript, senza backend. Vedi `README.md` per l'uso;
questo file raccoglie ciò che non è deducibile leggendo il codice.

## Vincoli reali dell'API Lichess

Verificati sull'API in produzione e sulla spec OpenAPI 2.0.155, non supposti:

- **Il CORS è aperto** (`Access-Control-Allow-Origin` riflette l'origin) e ammette
  `Authorization`. Per questo non serve alcun proxy. Gli header ammessi in richiesta sono solo
  `Origin, Authorization, If-Modified-Since, Cache-Control, Content-Type, X-Requested-With,
  sessionId`: non è possibile identificare l'app con uno User-Agent custom da browser.
- **`/api/games/user/{username}` rifiuta richieste sovrapposte** con
  `429 {"error":"Please only run 1 request(s) at a time"}`. Va sempre chiamato sulla corsia
  `serial` del limiter. Chi viola il limite resta in penalità per un po', anche dopo aver
  smesso.
- **Ricevuto un 429, Lichess chiede di attendere un minuto pieno.** Il limiter applica un
  cooldown globale (`src/lib/lichess/queue.ts`) invece di ritentare subito.
- **`POST /api/board/seek` non restituisce la partita.** La richiesta resta appesa, ed è la
  connessione aperta stessa a mantenere attiva l'inserzione nella lobby: chiuderla ritira la
  ricerca. La partita arriva come evento `gameStart` su `/api/stream/event`, quindi servono
  due connessioni simultanee (vedi `useSeek`).
- **Lo stream della Board API invia l'elenco completo delle mosse**, non un delta. La
  posizione va ricostruita da zero a ogni evento.
- **`POST /api/puzzle/batch/{angle}?nb=1`** registra il puzzle risolto *e* restituisce quello
  successivo: una richiesta invece di due. È il motivo per cui l'allenamento non usa
  `/api/puzzle/next` dopo il primo caricamento.

### Convenzione dei puzzle

Verificata su puzzle reali (script di controllo in `scratchpad`, 6/6 conformi):

- La posizione di partenza è quella dopo **tutte** le mosse di `game.pgn`.
- `puzzle.initialPly === numero di semimosse del PGN − 1`: l'ultima mossa del PGN è quella
  dell'avversario che crea il problema. Arrocco mostra la posizione precedente e poi la anima,
  come fa Lichess.
- `solution` alterna: **indici pari = mosse dell'utente**, dispari = risposte dell'avversario.
- Il colore dell'utente è quello di turno nella posizione iniziale.
- Una mossa che dà scacco matto va accettata anche se non è quella prevista (regola Lichess).

## Trappole già incontrate

- **Chessground applica la mossa dell'utente al proprio DOM prima che la validiamo.** Se poi
  la mossa viene rifiutata (puzzle sbagliato, mossa respinta dal server), il prop `fen` non
  cambia e l'effetto di sincronizzazione non riparte: la scacchiera resterebbe sulla posizione
  errata. Per questo `Board` ha un prop `revision` che i chiamanti incrementano per forzare il
  ripristino. Se aggiungi un nuovo percorso in cui una mossa può essere rifiutata, bumpa la
  revision.
- **Chessground ignora gli eventi sintetici**: `drag.ts` inizia con
  `if (!(s.trustAllEvents || e.isTrusted)) return`. Non si può pilotare la scacchiera con
  `dispatchEvent` in un test. In sviluppo l'API imperativa è però esposta su
  `document.querySelector('.arrocco-board').cgApi`, e chiamare
  `api.state.movable.events.after(orig, dest, {premove:false})` dopo `api.move()` riproduce
  esattamente una mossa dell'utente. È il modo con cui il flusso puzzle è stato verificato.
- **Il raggruppamento per giorno deve essere in ora locale.** Mai derivare la data da
  `toISOString()`: una partita alle 23:30 finirebbe nel giorno sbagliato. Vedi
  `src/lib/stats/activity.ts`.
- **TypeScript 7 ha rimosso `baseUrl`**: l'alias `@/*` sta solo in `paths`.
- `vite.config.ts` è ESM, quindi niente `__dirname` — si usa `import.meta.url`.

## Convenzioni

- **Lingua**: UI e commenti in italiano; identificatori in inglese.
- **Colore di brand**: `#8d57eb` = `--color-brand-500`. Non scrivere colori letterali nei
  componenti: usa la scala `brand-*` e i token semantici (`--surface`, `--text-primary`,
  `--border-subtle`…), che sono l'unico punto in cui light e dark divergono.
- **`base: './'` in Vite e hash routing sono requisiti**, non preferenze: garantiscono che il
  build funzioni da qualsiasi sottocartella e sotto il protocollo asset di Tauri. Non
  passare a `BrowserRouter`.
- **Numeri che cambiano** (orologi, rating, contatori) vogliono la classe `.tnum`, altrimenti
  "ballano".
- Tutte le chiamate API passano da `src/lib/lichess/client.ts`. Non usare `fetch` diretto
  verso Lichess: aggirerebbe limiter, cooldown e gestione degli errori tipizzati.

## Stato

- Il codice web è verificato: typecheck, build di produzione, avvio da sottocartella e flusso
  puzzle completo (mossa corretta accettata, mosse sbagliate rifiutate con ripristino, temi
  svelati alla fine).
- **Le sezioni che richiedono il login non sono state provate end-to-end**: servirebbe un
  account Lichess reale. Home, Gioca, Partita e Archivio sono scritti contro le shape
  verificate della spec, ma il primo accesso reale è il vero collaudo.
- **Il desktop Tauri non è mai stato compilato** (Rust assente sulla macchina di sviluppo).
