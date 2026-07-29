// Arrocco desktop: guscio Tauri attorno alla stessa SPA servita sul web.
//
// Non c'è logica applicativa qui. L'unica responsabilità nativa è il flusso
// OAuth: la pagina di consenso si apre nel browser di sistema e il codice
// torna all'app tramite lo schema `arrocco://`.

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default();

    // Va registrato per primo, prima di ogni altro plugin: intercetta l'avvio
    // di una seconda istanza (tipico quando il sistema apre un deep link) e
    // inoltra gli argomenti a quella già in esecuzione.
    #[cfg(desktop)]
    {
        builder = builder.plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
            use tauri::Emitter;
            let _ = app.emit("single-instance", argv);
        }));
    }

    builder
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|_app| {
            // In sviluppo lo schema custom non è registrato dall'installer,
            // quindi lo si registra a runtime: senza questo il login desktop
            // non funzionerebbe con `tauri dev`.
            #[cfg(all(desktop, debug_assertions))]
            {
                use tauri_plugin_deep_link::DeepLinkExt;
                let _ = _app.deep_link().register_all();
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("errore irreversibile nell'avvio di Arrocco");
}
