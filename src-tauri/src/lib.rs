use reqwest::Url;
use tauri::window::Color;
use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};

// Account auth module
pub mod account;

// Toggle fullscreen with smooth animation
#[tauri::command]
async fn toggle_fullscreen(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        let is_maximized = window.is_maximized().map_err(|e| e.to_string())?;

        if is_maximized {
            // Exit fullscreen - keep decorations hidden (app has custom titlebar)
            window.unmaximize().map_err(|e| e.to_string())?;
        } else {
            // Enter fullscreen - hide decorations and maximize
            window.maximize().map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

// Create a new application window
#[tauri::command]
async fn create_new_window(
    app: AppHandle,
    vault_path: Option<String>,
    note_path: Option<String>,
    view_mode: Option<String>,
) -> Result<(), String> {
    use std::sync::atomic::{AtomicU32, Ordering};
    static WINDOW_COUNTER: AtomicU32 = AtomicU32::new(1);

    let window_id = WINDOW_COUNTER.fetch_add(1, Ordering::SeqCst);
    let window_label = format!("main-{}", window_id);

    let mut launch_url =
        Url::parse("https://vlaina.local/index.html").map_err(|e| e.to_string())?;
    {
        let mut pairs = launch_url.query_pairs_mut();
        pairs.append_pair("newWindow", "true");

        if let Some(vault_path) = vault_path
            .as_deref()
            .map(str::trim)
            .filter(|value| !value.is_empty())
        {
            pairs.append_pair("vaultPath", vault_path);
        }

        if let Some(note_path) = note_path
            .as_deref()
            .map(str::trim)
            .filter(|value| !value.is_empty())
        {
            pairs.append_pair("notePath", note_path);
        }

        if let Some(view_mode) = view_mode
            .as_deref()
            .map(str::trim)
            .filter(|value| !value.is_empty())
        {
            pairs.append_pair("viewMode", view_mode);
        }
    }

    let url = WebviewUrl::App(
        format!(
            "index.html?{}",
            launch_url.query().unwrap_or("newWindow=true")
        )
        .into(),
    );

    // Calculate offset position based on window count (cascade effect)
    let offset = (window_id as f64) * 30.0;

    // Get target position before creating window
    let target_pos = if let Some(current_window) = app.get_webview_window("main") {
        current_window
            .outer_position()
            .ok()
            .map(|pos| (pos.x as f64 + offset, pos.y as f64 + offset))
    } else {
        None
    };

    // Create window hidden first, with position if available
    let mut builder = WebviewWindowBuilder::new(&app, &window_label, url)
        .title("vlaina")
        .inner_size(980.0, 640.0)
        .min_inner_size(720.0, 540.0)
        .decorations(false)
        .background_color(Color(255, 255, 255, 255))
        .resizable(false) // Start locked (Welcome mode)
        .maximizable(false)
        .visible(false); // Start hidden

    // Set position in builder if we have it
    if let Some((x, y)) = target_pos {
        builder = builder.position(x, y);
    } else {
        builder = builder.center();
    }

    let window = builder.build().map_err(|e: tauri::Error| e.to_string())?;

    // Show window after it's positioned
    window.show().map_err(|e: tauri::Error| e.to_string())?;

    Ok(())
}

#[tauri::command]
async fn focus_window(app: AppHandle, label: String) -> Result<bool, String> {
    if !is_valid_window_label(&label) {
        return Err(format!("Invalid window label: {}", label));
    }
    if let Some(window) = app.get_webview_window(&label) {
        window.set_focus().map_err(|e| e.to_string())?;
        window.unminimize().map_err(|e| e.to_string())?;
        Ok(true)
    } else {
        Ok(false)
    }
}

// Set window resizability (targets the invoking window)
#[tauri::command]
async fn set_window_resizable(window: tauri::WebviewWindow, resizable: bool) -> Result<(), String> {
    window.set_resizable(resizable).map_err(|e| e.to_string())?;
    window
        .set_maximizable(resizable)
        .map_err(|e| e.to_string())?;
    Ok(())
}

fn validate_user_path(raw: &str) -> Result<std::path::PathBuf, String> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return Err("Path is empty".to_string());
    }
    let path = std::path::Path::new(trimmed);
    path.canonicalize()
        .map_err(|e| format!("Invalid path '{}': {}", trimmed, e))
}

fn is_valid_window_label(label: &str) -> bool {
    label == "main" || label.starts_with("main-")
}

#[tauri::command]
async fn move_to_trash(path: String) -> Result<(), String> {
    let canonical = validate_user_path(&path)?;
    trash::delete(&canonical).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn open_external_url(url: String) -> Result<(), String> {
    let trimmed = url.trim();
    let parsed = Url::parse(trimmed).map_err(|e| format!("Invalid external URL: {}", e))?;
    match parsed.scheme() {
        "http" | "https" | "mailto" => account::auth::browser::open_auth_url(parsed.as_str()),
        _ => Err("Unsupported external URL scheme".to_string()),
    }
}

#[tauri::command]
async fn open_in_system_file_manager(path: String) -> Result<(), String> {
    use std::process::Command;

    let target = validate_user_path(&path)?;

    #[cfg(target_os = "windows")]
    {
        let status = Command::new("explorer")
            .arg(format!("/select,{}", target.display()))
            .status()
            .map_err(|e| e.to_string())?;
        if status.success() {
            return Ok(());
        }
        return Err(format!(
            "Failed to open file manager (explorer exit code {:?})",
            status.code()
        ));
    }

    #[cfg(target_os = "macos")]
    {
        let status = Command::new("open")
            .arg("-R")
            .arg(target)
            .status()
            .map_err(|e| e.to_string())?;
        if status.success() {
            return Ok(());
        }
        return Err(format!(
            "Failed to open file manager (open exit code {:?})",
            status.code()
        ));
    }

    #[cfg(all(unix, not(target_os = "macos")))]
    {
        let open_target = target.parent().unwrap_or(target.as_path());
        let status = Command::new("xdg-open")
            .arg(open_target)
            .status()
            .map_err(|e| e.to_string())?;
        if status.success() {
            return Ok(());
        }
        return Err(format!(
            "Failed to open file manager (xdg-open exit code {:?})",
            status.code()
        ));
    }

    #[allow(unreachable_code)]
    Err("Opening the system file manager is not supported on this platform".to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            toggle_fullscreen,
            create_new_window,
            set_window_resizable,
            focus_window,
            move_to_trash,
            open_external_url,
            open_in_system_file_manager,
            account::ai_secret_commands::get_ai_provider_secrets,
            account::ai_secret_commands::set_ai_provider_secret,
            account::ai_secret_commands::delete_ai_provider_secret,
            account::auth::session_commands::account_auth,
            account::auth::session_commands::account_disconnect,
            account::auth::session_commands::get_account_session_status,
            account::auth::session_commands::request_email_auth_code,
            account::auth::session_commands::verify_email_auth_code,
            account::auth::managed_api_commands::get_managed_models,
            account::auth::managed_api_commands::get_managed_budget,
            account::auth::managed_api_commands::managed_chat_completion,
            account::auth::managed_api_commands::managed_chat_completion_stream,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
