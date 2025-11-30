use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder, LogicalPosition};
use tauri::window::Color;

// Create drag overlay window
#[tauri::command]
async fn create_drag_window(app: AppHandle, content: String, x: f64, y: f64, width: f64, height: f64) -> Result<(), String> {
    // Close existing drag window if any
    if let Some(existing) = app.get_webview_window("drag-overlay") {
        let _ = existing.destroy();
    }

    // HTML content - transparent background, card fills window
    let html = format!(r#"<!DOCTYPE html>
<html style="background:transparent!important">
<head>
<style>
*{{margin:0;padding:0;box-sizing:border-box}}
html,body{{background:transparent!important;overflow:hidden;width:100%;height:100%}}
body{{font-family:system-ui,-apple-system,sans-serif;display:flex}}
.card{{
  background:#fff;
  border:1px solid #e5e5e5;
  border-radius:4px;
  padding:8px 12px;
  display:flex;
  align-items:center;
  gap:8px;
  font-size:14px;
  color:#18181b;
  width:100%;
  height:100%;
}}
.grip{{color:#a1a1aa}}
.checkbox{{width:16px;height:16px;border:1px solid #a1a1aa;border-radius:3px;flex-shrink:0}}
.content{{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}}
</style>
</head>
<body style="background:transparent!important">
<div class="card">
<div class="grip">⋮⋮</div>
<div class="checkbox"></div>
<span class="content">{}</span>
</div>
</body>
</html>"#, content);

    // Create transparent window - hidden first, show after setup
    let window = WebviewWindowBuilder::new(
        &app,
        "drag-overlay",
        WebviewUrl::default(),
    )
    .title("")
    .inner_size(width, height)
    .position(x - 20.0, y - (height / 2.0))
    .decorations(false)
    .transparent(true)
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
    window.set_ignore_cursor_events(true).map_err(|e| e.to_string())?;

    // Inject HTML content
    window.eval(&format!(r#"document.write(`{}`); document.close();"#, html.replace('`', "\\`")))
        .map_err(|e| e.to_string())?;

    // Show window
    window.show().map_err(|e| e.to_string())?;

    Ok(())
}

// Update drag window position
#[tauri::command]
async fn update_drag_window_position(app: AppHandle, x: f64, y: f64) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("drag-overlay") {
        // Get window height for vertical centering
        let size = window.outer_size().unwrap_or(tauri::PhysicalSize::new(0, 36));
        let half_height = (size.height as f64) / 2.0;
        window.set_position(LogicalPosition::new(x - 20.0, y - half_height))
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            create_drag_window,
            update_drag_window_position,
            destroy_drag_window
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
