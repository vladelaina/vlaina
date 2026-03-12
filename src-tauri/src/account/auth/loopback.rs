use reqwest::Url;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpListener;
use tokio::time::{timeout, Duration, Instant};

const LOOPBACK_BIND_ADDR: &str = "127.0.0.1:0";
const LOOPBACK_CALLBACK_PATH: &str = "/oauth/callback";
const MAX_REQUEST_BYTES: usize = 8192;

pub struct LoopbackServer {
    listener: TcpListener,
    pub callback_url: String,
}

pub struct LoopbackCallback {
    pub state: String,
    pub error: Option<String>,
}

pub async fn bind_loopback_server() -> Result<LoopbackServer, String> {
    let listener = TcpListener::bind(LOOPBACK_BIND_ADDR)
        .await
        .map_err(|e| format!("Failed to bind local OAuth callback server: {}", e))?;
    let addr = listener
        .local_addr()
        .map_err(|e| format!("Failed to read local OAuth callback address: {}", e))?;
    Ok(LoopbackServer {
        listener,
        callback_url: format!("http://127.0.0.1:{}{}", addr.port(), LOOPBACK_CALLBACK_PATH),
    })
}

fn html_response(status: &str, title: &str, message: &str) -> String {
    let body = format!(
        "<!doctype html><html><head><meta charset=\"utf-8\"><title>{}</title></head><body><h1>{}</h1><p>{}</p><p>You can return to NekoTick now.</p></body></html>",
        title, title, message
    );
    format!(
        "HTTP/1.1 {}\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
        status,
        body.len(),
        body
    )
}

async fn write_http_response(stream: &mut tokio::net::TcpStream, response: String) {
    let _ = stream.write_all(response.as_bytes()).await;
    let _ = stream.flush().await;
}

fn parse_request_target(request: &str) -> Option<(String, String)> {
    let first_line = request.lines().next()?.trim();
    let mut parts = first_line.split_whitespace();
    let method = parts.next()?.to_string();
    let target = parts.next()?.to_string();
    Some((method, target))
}

fn parse_loopback_callback(target: &str) -> Result<LoopbackCallback, String> {
    let url = Url::parse(&format!("http://127.0.0.1{}", target))
        .map_err(|e| format!("Invalid OAuth callback URL: {}", e))?;
    if url.path() != LOOPBACK_CALLBACK_PATH {
      return Err("Unexpected OAuth callback path".to_string());
    }

    let mut state: Option<String> = None;
    let mut error: Option<String> = None;
    for (key, value) in url.query_pairs() {
        match key.as_ref() {
            "state" => {
                let trimmed = value.trim();
                if !trimmed.is_empty() {
                    state = Some(trimmed.to_string());
                }
            }
            "error" => {
                let trimmed = value.trim();
                if !trimmed.is_empty() {
                    error = Some(trimmed.to_string());
                }
            }
            _ => {}
        }
    }

    let state = state.ok_or_else(|| "OAuth callback is missing state".to_string())?;
    Ok(LoopbackCallback { state, error })
}

impl LoopbackServer {
    pub async fn wait_for_callback(self, expected_state: &str, timeout_seconds: u64) -> Result<LoopbackCallback, String> {
        let deadline = Instant::now() + Duration::from_secs(timeout_seconds.max(30));
        let listener = self.listener;

        loop {
            let remaining = deadline
                .checked_duration_since(Instant::now())
                .ok_or_else(|| "Authorization timed out".to_string())?;
            let (mut stream, _) = timeout(remaining, listener.accept())
                .await
                .map_err(|_| "Authorization timed out".to_string())?
                .map_err(|e| format!("Failed to accept local OAuth callback: {}", e))?;

            let mut buffer = vec![0u8; MAX_REQUEST_BYTES];
            let read = stream
                .read(&mut buffer)
                .await
                .map_err(|e| format!("Failed to read local OAuth callback: {}", e))?;
            if read == 0 {
                continue;
            }

            let request = String::from_utf8_lossy(&buffer[..read]).to_string();
            let Some((method, target)) = parse_request_target(&request) else {
                write_http_response(
                    &mut stream,
                    html_response("400 Bad Request", "Authorization Failed", "Invalid callback request."),
                )
                .await;
                continue;
            };

            if method != "GET" {
                write_http_response(
                    &mut stream,
                    html_response("405 Method Not Allowed", "Authorization Failed", "Unsupported callback method."),
                )
                .await;
                continue;
            }

            let callback = match parse_loopback_callback(&target) {
                Ok(value) => value,
                Err(error) => {
                    write_http_response(
                        &mut stream,
                        html_response("400 Bad Request", "Authorization Failed", &error),
                    )
                    .await;
                    continue;
                }
            };

            if callback.state != expected_state {
                write_http_response(
                    &mut stream,
                    html_response("400 Bad Request", "Authorization Failed", "OAuth state mismatch."),
                )
                .await;
                continue;
            }

            let response = if let Some(error) = callback.error.as_deref() {
                html_response("200 OK", "Authorization Failed", error)
            } else {
                html_response(
                    "200 OK",
                    "Authorization Successful",
                    "You can close this window and return to NekoTick.",
                )
            };
            write_http_response(&mut stream, response).await;
            return Ok(callback);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::parse_loopback_callback;

    #[test]
    fn parses_successful_callback() {
        let callback = parse_loopback_callback("/oauth/callback?state=dsk_123").unwrap();
        assert_eq!(callback.state, "dsk_123");
        assert!(callback.error.is_none());
    }

    #[test]
    fn parses_error_callback() {
        let callback = parse_loopback_callback("/oauth/callback?state=dsk_123&error=denied").unwrap();
        assert_eq!(callback.state, "dsk_123");
        assert_eq!(callback.error.as_deref(), Some("denied"));
    }

    #[test]
    fn rejects_unexpected_path() {
        assert!(parse_loopback_callback("/wrong?state=dsk_123").is_err());
    }
}
