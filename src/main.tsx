import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { App } from './App';
import './styles/index.css';
import './styles/board.css';

/**
 * Si usa HashRouter, non BrowserRouter, per una ragione precisa: le rotte
 * vivono dopo il `#`, quindi qualsiasi server statico (nginx, Caddy, Apache,
 * `python -m http.server`, GitHub Pages) serve correttamente l'app senza
 * regole di rewrite. Lo stesso vale per il protocollo asset di Tauri.
 * Il costo è un URL meno elegante; il vantaggio è che il self-hosting
 * funziona sempre, che è l'obiettivo di Arrocco.
 */

const container = document.getElementById('root');
if (!container) throw new Error('Elemento #root non trovato in index.html');

createRoot(container).render(
  <StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </StrictMode>,
);
