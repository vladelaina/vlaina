#[cfg(any(
    target_os = "windows",
    target_os = "macos",
    all(unix, not(target_os = "macos"))
))]
use std::process::Command;

pub fn open_auth_url(url: &str) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        let status = Command::new("rundll32")
            .args(["url.dll,FileProtocolHandler", url])
            .status()
            .map_err(|e| format!("Failed to open browser: {}", e))?;
        if status.success() {
            return Ok(());
        }

        let explorer_status = Command::new("explorer")
            .arg(url)
            .status()
            .map_err(|e| format!("Failed to open browser: {}", e))?;
        if explorer_status.success() {
            return Ok(());
        }

        return Err(format!(
            "Failed to open browser (rundll32 exit code {:?}, explorer exit code {:?})",
            status.code(),
            explorer_status.code()
        ));
    }

    #[cfg(target_os = "macos")]
    {
        let status = Command::new("open")
            .arg(url)
            .status()
            .map_err(|e| format!("Failed to open browser: {}", e))?;
        if status.success() {
            return Ok(());
        }
        return Err(format!(
            "Failed to open browser (open exit code {:?})",
            status.code()
        ));
    }

    #[cfg(all(unix, not(target_os = "macos")))]
    {
        let status = Command::new("xdg-open")
            .arg(url)
            .status()
            .map_err(|e| format!("Failed to open browser: {}", e))?;
        if status.success() {
            return Ok(());
        }
        Err(format!(
            "Failed to open browser (xdg-open exit code {:?})",
            status.code()
        ))
    }
}
