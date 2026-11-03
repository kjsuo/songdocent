mod annotation;
mod app_updates;
mod app_error;
mod cache;
mod cloud_models;
mod cli_ai;
mod grounding;
mod lyrics;
mod player;
mod player_events;
#[cfg(target_os = "macos")]
mod player_events_macos;
#[cfg(target_os = "windows")]
mod player_events_windows;
mod player_identity;
#[cfg(any(target_os = "windows", test))]
mod player_timeline;
#[cfg(target_os = "macos")]
mod player_macos;
#[cfg(not(any(target_os = "macos", target_os = "windows")))]
mod player_unsupported;
#[cfg(target_os = "windows")]
mod player_windows;
mod provider_connection;
mod secrets;
mod setup_validation;
mod spotify_resolver;
mod translation;
#[cfg(test)]
mod windows_build_contract;
#[cfg(target_os = "windows")]
mod winrt_runtime;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_process::init())
        .manage(provider_connection::ProviderConnectionService::default())
        .setup(|app| {
            #[cfg(any(target_os = "macos", target_os = "windows"))]
            app.handle().plugin(tauri_plugin_updater::Builder::new().build())?;
            #[cfg(any(target_os = "macos", target_os = "windows"))]
            player_events::register(app.handle());
            #[cfg(not(any(target_os = "macos", target_os = "windows")))]
            let _ = app;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            app_updates::get_update_configuration,
            player::get_current_track,
            player::get_player_position,
            player::control_player,
            lyrics::get_spotify_lyrics,
            lyrics::get_apple_music_lyrics,
            lyrics::resolve_itunes_genre,
            cloud_models::list_cloud_ai_models,
            cli_ai::scan_cli_providers,
            cli_ai::list_cli_models,
            cli_ai::test_cli_connection,
            cli_ai::cancel_cli_ai_request,
            translation::translate_lyrics,
            translation::annotate_lyrics_selection,
            translation::test_local_ai_connection,
            translation::test_openai_compatible_connection,
            cache::apply_translation_cache,
            cache::save_translation_cache,
            cache::clear_translation_cache,
            secrets::get_secret_status,
            secrets::set_secret,
            secrets::clear_secret,
            setup_validation::validate_setup_credential,
            provider_connection::start_provider_connection,
            provider_connection::get_provider_connection_status,
            provider_connection::cancel_provider_connection,
        ])
        .build(tauri::generate_context!())
        .expect("error while building SongDocent")
        .run(|_, event| {
            if matches!(event, tauri::RunEvent::Exit | tauri::RunEvent::ExitRequested { .. }) { cli_ai::cancel_all(); }
        });
}
