use reqwest::Url;
use tauri::window::Color;
use tauri::{AppHandle, LogicalPosition, Manager, WebviewUrl, WebviewWindowBuilder};

// Account auth module
pub mod account;

fn escape_html(input: &str) -> String {
    let mut out = String::with_capacity(input.len());
    for ch in input.chars() {
        match ch {
            '&' => out.push_str("&amp;"),
            '<' => out.push_str("&lt;"),
            '>' => out.push_str("&gt;"),
            '"' => out.push_str("&quot;"),
            '\'' => out.push_str("&#39;"),
            _ => out.push(ch),
        }
    }
    out
}

struct DragWindowRequest {
    content: String,
    x: f64,
    y: f64,
    width: f64,
    height: f64,
    is_done: bool,
    is_dark: bool,
    color: Option<String>,
}

async fn create_drag_window_impl(app: AppHandle, request: DragWindowRequest) -> Result<(), String> {
    let DragWindowRequest {
        content,
        x,
        y,
        width,
        height,
        is_done,
        is_dark,
        color,
    } = request;

    if let Some(existing) = app.get_webview_window("drag-overlay") {
        let _ = existing.destroy();
    }

    // Theme-based colors
    let (bg_color, border_color, text_color, text_muted) = if is_dark {
        ("#18181b", "#3f3f46", "#fafafa", "#71717a")
    } else {
        ("#fff", "#e5e5e5", "#18181b", "#a1a1aa")
    };

    // Task color - Apple style colors
    let task_color = match color.as_deref() {
        Some("red") => "#FE002D",
        Some("orange") => "#FF8500",
        Some("yellow") => "#FEC900",
        Some("green") => "#63DA38",
        Some("blue") => "#008BFE",
        Some("purple") => "#DD11E8",
        Some("brown") => "#B47D58",
        _ => text_muted,
    };

    let has_color = color.is_some() && color.as_deref() != Some("default");

    // Style for completed tasks
    let content_style = if is_done {
        format!("text-decoration:line-through;color:{}", text_muted)
    } else {
        String::new()
    };

    let checkbox_html = if is_done {
        format!("<svg class=\"checkbox\" viewBox=\"0 0 16 16\"><rect x=\"0.5\" y=\"0.5\" width=\"15\" height=\"15\" rx=\"2\" fill=\"{}\" stroke=\"{}\"/><path d=\"M4 8l3 3 5-6\" stroke=\"white\" stroke-width=\"2\" fill=\"none\"/></svg>", text_color, text_color)
    } else if has_color {
        format!(
            "<div class=\"checkbox\" style=\"border:2px solid {}\"></div>",
            task_color
        )
    } else {
        format!(
            "<div class=\"checkbox\" style=\"border-color:{}\"></div>",
            text_muted
        )
    };

    let escaped_content = escape_html(&content);

    // HTML content - transparent background, card fills window
    let html = format!(
        r#"<!DOCTYPE html>
<html style="background:transparent!important">
<head>
<style>
*{{margin:0;padding:0;box-sizing:border-box}}
html,body{{background:transparent!important;overflow:hidden;width:100%;height:100%}}
body{{font-family:system-ui,-apple-system,sans-serif;display:flex}}
.card{{
  background:{};
  border:1px solid {};
  border-radius:4px;
  padding:8px 12px;
  display:flex;
  align-items:start;
  gap:8px;
  font-size:14px;
  color:{};
  width:100%;
  height:100%;
}}
.grip{{color:{}}}
.checkbox{{width:16px;height:16px;border:1px solid {};border-radius:3px;flex-shrink:0;margin-top:2px}}
.content{{flex:1;white-space:pre-wrap;word-break:break-word;overflow-wrap:anywhere}}
</style>
</head>
<body style="background:transparent!important">
<div class="card">
<div class="grip">⋮⋮</div>
{}
<span class="content" style="{}">{}</span>
</div>
</body>
</html>"#,
        bg_color,
        border_color,
        text_color,
        text_muted,
        text_muted,
        checkbox_html,
        content_style,
        escaped_content
    );

    // Create transparent window - hidden first, show after setup
    let window = WebviewWindowBuilder::new(&app, "drag-overlay", WebviewUrl::default())
        .title("")
        .inner_size(width, height)
        .position(x - 20.0, y - (height / 2.0))
        .decorations(false)
        .shadow(false)
        .background_color(Color(0, 0, 0, 0))
        .always_on_top(true)
        .skip_taskbar(true)
        .resizable(false)
        .focused(false)
        .visible(false)
        .build()
        .map_err(|e| e.to_string())?;

    // Ignore cursor events so drag continues
    window
        .set_ignore_cursor_events(true)
        .map_err(|e| e.to_string())?;

    // Inject HTML content safely (JSON string escaping avoids JS template injection).
    let html_json = serde_json::to_string(&html).map_err(|e| e.to_string())?;
    window
        .eval(format!(
            r#"document.open(); document.write({}); document.close();"#,
            html_json
        ))
        .map_err(|e| e.to_string())?;

    // Show window
    window.show().map_err(|e| e.to_string())?;

    Ok(())
}

#[allow(clippy::too_many_arguments)]
#[tauri::command]
async fn create_drag_window(
    app: AppHandle,
    content: String,
    x: f64,
    y: f64,
    width: f64,
    height: f64,
    is_done: bool,
    is_dark: bool,
    color: Option<String>,
) -> Result<(), String> {
    create_drag_window_impl(
        app,
        DragWindowRequest {
            content,
            x,
            y,
            width,
            height,
            is_done,
            is_dark,
            color,
        },
    )
    .await
}

// Update drag window position
#[tauri::command]
async fn update_drag_window_position(app: AppHandle, x: f64, y: f64) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("drag-overlay") {
        // Get window height for vertical centering
        let size = window
            .outer_size()
            .unwrap_or(tauri::PhysicalSize::new(0, 36));
        let half_height = (size.height as f64) / 2.0;
        window
            .set_position(LogicalPosition::new(x - 20.0, y - half_height))
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

// Destroy drag window
#[tauri::command]
async fn destroy_drag_window(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("drag-overlay") {
        window.destroy().map_err(|e| e.to_string())?;
    }
    Ok(())
}

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

// Create a new application window (opens to welcome screen)
#[tauri::command]
async fn create_new_window(app: AppHandle) -> Result<(), String> {
    use std::sync::atomic::{AtomicU32, Ordering};
    static WINDOW_COUNTER: AtomicU32 = AtomicU32::new(1);

    let window_id = WINDOW_COUNTER.fetch_add(1, Ordering::SeqCst);
    let window_label = format!("main-{}", window_id);

    // Use URL with query param to indicate new window should show welcome screen
    let url = WebviewUrl::App("index.html?newWindow=true".into());

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
        .background_color(Color(0, 0, 0, 0))
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

// Focus a window by label and bring it to front
#[tauri::command]
async fn focus_window(app: AppHandle, label: String) -> Result<bool, String> {
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

// Move file to system trash
#[tauri::command]
async fn move_to_trash(path: String) -> Result<(), String> {
    trash::delete(&path).map_err(|e| e.to_string())?;
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            create_drag_window,
            update_drag_window_position,
            destroy_drag_window,
            toggle_fullscreen,
            create_new_window,
            set_window_resizable,
            focus_window,
            move_to_trash,
            open_external_url,
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
