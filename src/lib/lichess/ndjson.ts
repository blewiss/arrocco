/**
 * Lettura di stream ndjson (una riga = un oggetto JSON).
 *
 * Due dettagli del protocollo Lichess che vanno gestiti:
 *  - vengono inviate righe vuote come keep-alive, da ignorare;
 *  - un oggetto può essere spezzato fra due chunk della rete, quindi serve un
 *    buffer che accumuli fino al prossimo newline.
 */

export async function* readNdjson<T>(
  response: Response,
  signal?: AbortSignal,
): AsyncGenerator<T, void, undefined> {
  const body = response.body;
  if (!body) throw new Error('Risposta senza corpo: stream non disponibile.');

  const reader = body.pipeThrough(new TextDecoderStream()).getReader();

  // Se il chiamante annulla, sblocchiamo il reader per liberare la connessione.
  const onAbort = () => void reader.cancel().catch(() => {});
  signal?.addEventListener('abort', onAbort, { once: true });

  let buffer = '';
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += value;

      let newlineIndex = buffer.indexOf('\n');
      while (newlineIndex !== -1) {
        const line = buffer.slice(0, newlineIndex).trim();
        buffer = buffer.slice(newlineIndex + 1);
        if (line) yield JSON.parse(line) as T;
        newlineIndex = buffer.indexOf('\n');
      }
    }

    // L'ultima riga può non essere terminata da newline.
    const tail = buffer.trim();
    if (tail) yield JSON.parse(tail) as T;
  } finally {
    signal?.removeEventListener('abort', onAbort);
    reader.releaseLock();
  }
}

/** Raccoglie uno stream ndjson finito in un array. */
export async function collectNdjson<T>(response: Response, signal?: AbortSignal): Promise<T[]> {
  const items: T[] = [];
  for await (const item of readNdjson<T>(response, signal)) items.push(item);
  return items;
}
