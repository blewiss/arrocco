/**
 * Rilevamento della piattaforma di esecuzione.
 *
 * Arrocco gira in due contesti dallo stesso bundle: una pagina web servita da
 * un qualsiasi server statico, e una finestra Tauri. Le differenze rilevanti
 * sono poche ma importanti — soprattutto il redirect OAuth — e sono isolate qui.
 */

/**
 * Tauri v2 inietta `window.__TAURI_INTERNALS__` nel contesto della webview.
 * È il segnale più affidabile: non dipende dallo user agent, che su Windows è
 * indistinguibile da un normale Edge/WebView2.
 */
export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

/**
 * Schema del deep link registrato dall'app desktop.
 *
 * Su desktop non esiste un URL http a cui Lichess possa rimandare: la webview
 * non è raggiungibile dall'esterno. Si registra quindi uno schema custom presso
 * il sistema operativo, e Lichess vi reindirizza al termine del consenso.
 * Deve coincidere con `plugins.deep-link.desktop.schemes` in tauri.conf.json.
 */
export const DEEP_LINK_SCHEME = 'arrocco';

export const DESKTOP_REDIRECT_URI = `${DEEP_LINK_SCHEME}://oauth`;
