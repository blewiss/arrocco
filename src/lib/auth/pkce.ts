import {
  LICHESS_AUTHORIZE_URL,
  LICHESS_ORIGIN,
  LICHESS_TOKEN_URL,
  OAUTH_CLIENT_ID,
  OAUTH_SCOPES,
} from '../lichess/config';
import { DESKTOP_REDIRECT_URI, isTauri } from '../platform';
import { StorageKeys, storage } from '../storage';

/**
 * OAuth2 Authorization Code + PKCE verso Lichess.
 *
 * Lichess non prevede registrazione dell'app né client secret: qualsiasi
 * client pubblico può autenticarsi con PKCE. Questo è ciò che rende Arrocco
 * completamente self-hostabile senza backend — non c'è nessun segreto da
 * custodire lato server.
 */

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function randomUrlSafe(byteLength: number): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes);
}

async function sha256Challenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return base64UrlEncode(new Uint8Array(digest));
}

/**
 * URI di redirect.
 *
 * Deve coincidere byte per byte fra la richiesta di autorizzazione e quella di
 * token, altrimenti Lichess rifiuta lo scambio.
 *
 * Sul web usiamo origin + pathname, escludendo query e hash: con l'hash routing
 * di Arrocco il pathname è stabile anche quando l'app è servita da una
 * sottocartella (es. https://casa.mia/arrocco/).
 *
 * Su desktop non esiste un URL http raggiungibile dall'esterno, quindi si usa
 * lo schema custom registrato dall'app (vedi `platform.ts`).
 */
export function redirectUri(): string {
  if (isTauri()) return DESKTOP_REDIRECT_URI;
  return `${window.location.origin}${window.location.pathname}`;
}

export interface StoredToken {
  accessToken: string;
  /** Timestamp ms di scadenza, oppure null se l'API non l'ha comunicata. */
  expiresAt: number | null;
}

/** Avvia il flusso: salva verifier e state, poi porta l'utente su Lichess. */
export async function beginLogin(): Promise<void> {
  const verifier = randomUrlSafe(48);
  const state = randomUrlSafe(16);
  const challenge = await sha256Challenge(verifier);

  // Salvati prima del redirect: al ritorno sono l'unica prova che la richiesta
  // è partita da questa scheda e non da un attacco CSRF.
  storage.set(StorageKeys.pkceVerifier, verifier);
  storage.set(StorageKeys.pkceState, state);

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: OAUTH_CLIENT_ID,
    redirect_uri: redirectUri(),
    code_challenge_method: 'S256',
    code_challenge: challenge,
    scope: OAUTH_SCOPES.join(' '),
    state,
  });

  const authorizeUrl = `${LICHESS_AUTHORIZE_URL}?${params.toString()}`;

  if (isTauri()) {
    // Su desktop la pagina di consenso va aperta nel browser di sistema, non
    // nella webview: l'utente deve poter vedere il vero dominio lichess.org
    // nella barra degli indirizzi prima di autorizzare, e riusa la sessione
    // Lichess che ha già nel browser.
    const { openUrl } = await import('@tauri-apps/plugin-opener');
    await openUrl(authorizeUrl);
    return;
  }

  window.location.assign(authorizeUrl);
}

export interface CallbackResult {
  status: 'success' | 'denied' | 'error' | 'none';
  token?: StoredToken;
  message?: string;
}

/**
 * Completa il flusso se l'URL corrente contiene una risposta OAuth.
 *
 * Restituisce `none` quando non c'è nulla da elaborare, così può essere
 * chiamata a ogni avvio senza condizioni al chiamante. In ogni caso ripulisce
 * la query string, per non lasciare il codice di autorizzazione nella barra
 * degli indirizzi né nella cronologia.
 */
export async function completeLoginFromUrl(): Promise<CallbackResult> {
  const result = await consumeCallbackParams(new URLSearchParams(window.location.search));
  // La query va ripulita solo sul web, dove è effettivamente nella barra
  // degli indirizzi e nella cronologia.
  if (result.status !== 'none') scrubQueryString();
  return result;
}

/**
 * Completa il flusso a partire da un deep link `arrocco://oauth?code=…`.
 *
 * Usata solo su desktop: il consenso avviene nel browser di sistema, che al
 * termine consegna il codice all'app tramite lo schema registrato.
 */
export async function completeLoginFromDeepLink(url: string): Promise<CallbackResult> {
  try {
    // Gli schemi custom non hanno un host, quindi `new URL` può produrre un
    // pathname inatteso: leggiamo solo la query, che è ciò che ci serve.
    const query = url.includes('?') ? url.slice(url.indexOf('?') + 1) : '';
    return consumeCallbackParams(new URLSearchParams(query));
  } catch {
    return { status: 'error', message: 'Deep link OAuth non interpretabile.' };
  }
}

async function consumeCallbackParams(params: URLSearchParams): Promise<CallbackResult> {
  const code = params.get('code');
  const returnedState = params.get('state');
  const oauthError = params.get('error');

  if (!code && !oauthError) return { status: 'none' };

  const expectedState = storage.get(StorageKeys.pkceState);
  const verifier = storage.get(StorageKeys.pkceVerifier);
  storage.remove(StorageKeys.pkceState);
  storage.remove(StorageKeys.pkceVerifier);

  if (oauthError) {
    return {
      status: oauthError === 'access_denied' ? 'denied' : 'error',
      message:
        oauthError === 'access_denied'
          ? 'Autorizzazione annullata su Lichess.'
          : `Lichess ha rifiutato la richiesta: ${oauthError}`,
    };
  }

  if (!verifier || !expectedState) {
    return {
      status: 'error',
      message: 'Sessione di login scaduta. Riprova ad accedere.',
    };
  }

  if (returnedState !== expectedState) {
    return {
      status: 'error',
      message: 'Verifica di sicurezza non superata (state non corrispondente).',
    };
  }

  return exchangeCode(code as string, verifier);
}

async function exchangeCode(code: string, verifier: string): Promise<CallbackResult> {
  try {
    const response = await fetch(LICHESS_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      credentials: 'omit',
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        code_verifier: verifier,
        redirect_uri: redirectUri(),
        client_id: OAUTH_CLIENT_ID,
      }).toString(),
    });

    if (!response.ok) {
      const detail = await response.text();
      return {
        status: 'error',
        message: `Scambio del token fallito (${response.status}). ${detail.slice(0, 160)}`,
      };
    }

    const payload = (await response.json()) as {
      access_token?: string;
      expires_in?: number;
    };

    if (!payload.access_token) {
      return { status: 'error', message: 'Lichess non ha restituito un access token.' };
    }

    return {
      status: 'success',
      token: {
        accessToken: payload.access_token,
        expiresAt:
          typeof payload.expires_in === 'number' ? Date.now() + payload.expires_in * 1000 : null,
      },
    };
  } catch (cause) {
    return {
      status: 'error',
      message: `Impossibile contattare Lichess per il token. ${String(cause)}`,
    };
  }
}

/** Rimuove la query string mantenendo l'hash (la rotta corrente). */
function scrubQueryString(): void {
  const clean = `${window.location.pathname}${window.location.hash}`;
  window.history.replaceState(null, '', clean);
}

/**
 * Revoca il token lato Lichess. Best-effort: se la chiamata fallisce
 * procediamo comunque a cancellarlo in locale, perché il logout non deve
 * poter essere bloccato da un problema di rete.
 */
export async function revokeToken(accessToken: string): Promise<void> {
  try {
    await fetch(`${LICHESS_ORIGIN}/api/token`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
      credentials: 'omit',
    });
  } catch {
    /* ignorato deliberatamente */
  }
}
