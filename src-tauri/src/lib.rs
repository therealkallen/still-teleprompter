mod asr;
mod capture;
mod hotkeys;
mod persistence;

use tauri::Manager;
use tauri_plugin_window_state::StateFlags;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _, _| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.show();
            }
        }))
        .plugin(
            tauri_plugin_window_state::Builder::default()
                .with_state_flags(StateFlags::POSITION | StateFlags::SIZE)
                .build(),
        )
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .manage(persistence::StorageLock::default())
        .manage(hotkeys::Hotkeys::default())
        .manage(asr::AsrService::default())
        .setup(|app| {
            let window = app
                .get_webview_window("main")
                .ok_or("Missing main window")?;
            capture::install(&window).map_err(std::io::Error::other)?;
            // Protect before the window is ever displayed; JS reapplies the saved preference.
            let _ = capture::set_capture_protection(window.clone(), true);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            capture::set_capture_protection,
            capture::set_reading_mode,
            persistence::load_workspace,
            persistence::save_workspace,
            hotkeys::configure_hotkeys,
            asr::list_microphones,
            asr::start_auto_follow,
            asr::stop_auto_follow,
            asr::reset_auto_follow,
            reveal_window
        ])
        .run(tauri::generate_context!())
        .expect("Unable to start Still");
}

#[tauri::command]
fn reveal_window(window: tauri::WebviewWindow) -> Result<(), String> {
    window.show().map_err(|e| e.to_string())
}
