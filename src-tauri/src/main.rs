// Su Windows in release nasconde la finestra della console che altrimenti
// comparirebbe accanto all'app.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    arrocco_lib::run()
}
