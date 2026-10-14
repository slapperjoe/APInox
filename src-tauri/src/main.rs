// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    // Started as the update helper (`APInox.exe --apply-update <dir>`): wait for
    // the app to exit, swap the staged files and relaunch. Handled before Tauri
    // initialises so the helper never opens a window. Also runs the post-update
    // cleanup on every normal start.
    if apinox_lib::updater::run_update_helper_if_requested() {
        return;
    }
    apinox_lib::run();
}
