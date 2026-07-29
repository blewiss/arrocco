/** Endpoint e parametri OAuth di Lichess, verificati sulla spec OpenAPI 2.0.155. */

export const LICHESS_ORIGIN = 'https://lichess.org';
export const LICHESS_AUTHORIZE_URL = `${LICHESS_ORIGIN}/oauth`;
export const LICHESS_TOKEN_URL = `${LICHESS_ORIGIN}/api/token`;

/**
 * Lichess identifica le app pubbliche PKCE tramite il solo client_id: non
 * esiste registrazione preventiva né client secret, quindi questo valore è
 * puramente descrittivo e appare nella schermata di consenso.
 */
export const OAUTH_CLIENT_ID = 'arrocco.app';

/**
 * Scope richiesti, ridotti al minimo necessario per le funzionalità v1:
 *  - board:play        creare e giocare partite via Board API
 *  - challenge:write   creare partite contro Stockfish e sfide dirette
 *  - puzzle:read       leggere storico e dashboard puzzle (per la heatmap)
 *  - puzzle:write      registrare i puzzle risolti sul proprio account
 *  - preference:read   leggere le preferenze (es. orientamento scacchiera)
 *
 * Deliberatamente esclusi: email:read, e ogni scope di scrittura sull'account.
 */
export const OAUTH_SCOPES = [
  'board:play',
  'challenge:write',
  'puzzle:read',
  'puzzle:write',
  'preference:read',
] as const;

export const APP_VERSION = '1.0.0';

/**
 * Il CORS di Lichess ammette solo questi header in richiesta:
 *   Origin, Authorization, If-Modified-Since, Cache-Control, Content-Type,
 *   X-Requested-With, sessionId
 * Da browser non è quindi possibile identificare l'app con uno User-Agent
 * custom (header comunque proibito dalla fetch spec). L'identificazione
 * avviene tramite il client_id nel flusso OAuth.
 */
export const DEFAULT_TIMEOUT_MS = 20_000;
