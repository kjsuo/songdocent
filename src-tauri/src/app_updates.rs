use serde::Serialize;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateConfiguration {
    configured: bool,
    version: String,
}

#[tauri::command]
pub fn get_update_configuration(app: tauri::AppHandle) -> UpdateConfiguration {
    let configured = app.config().plugins.0.get("updater").is_some_and(|config| {
        config["pubkey"].as_str().is_some_and(|key| !key.trim().is_empty())
            && config["endpoints"].as_array().is_some_and(|urls| !urls.is_empty())
    });
    UpdateConfiguration { configured, version: app.package_info().version.to_string() }
}
