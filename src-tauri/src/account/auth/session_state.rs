use crate::account::credentials::delete_account_credentials;
use reqwest::StatusCode;
use serde_json::Value;
use tauri::Emitter;

pub const ACCOUNT_AUTH_INVALIDATED_EVENT: &str = "vlaina:account-auth-invalidated";
pub const MANAGED_API_SESSION_EXPIRED_ERROR: &str = "Managed API session expired";

pub fn invalidate_account_auth(app: &tauri::AppHandle) {
    let _ = delete_account_credentials(app);
    let _ = app.emit(ACCOUNT_AUTH_INVALIDATED_EVENT, ());
}

pub fn is_managed_session_invalid(status: StatusCode, raw_body: &str) -> bool {
    if status == StatusCode::UNAUTHORIZED {
        return true;
    }

    if status != StatusCode::FORBIDDEN {
        return false;
    }

    let normalized = extract_api_error_message(raw_body)
        .unwrap_or_else(|| raw_body.trim().to_string())
        .to_lowercase();

    [
        "missing session token",
        "invalid session token",
        "session verification failed",
        "session expired",
        "sign-in required",
        "sign in required",
        "unauthorized",
        "unauthenticated",
    ]
    .iter()
    .any(|keyword| normalized.contains(keyword))
}

pub fn managed_api_error_message(status: StatusCode, raw_body: &str) -> String {
    let detail = extract_api_error_message(raw_body).unwrap_or_else(|| raw_body.trim().to_string());
    format!(
        "Managed API failed with status {}: {}",
        status.as_u16(),
        detail
    )
}

fn extract_api_error_message(raw_body: &str) -> Option<String> {
    let payload: Value = serde_json::from_str(raw_body).ok()?;

    if let Some(value) = payload
        .get("error")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        return Some(value.to_string());
    }

    if let Some(value) = payload
        .get("message")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        return Some(value.to_string());
    }

    if let Some(value) = payload
        .get("error")
        .and_then(Value::as_object)
        .and_then(|error| error.get("message"))
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        return Some(value.to_string());
    }

    None
}

#[cfg(test)]
mod tests {
    use super::{is_managed_session_invalid, managed_api_error_message};
    use reqwest::StatusCode;

    #[test]
    fn treats_401_as_invalid_session() {
        assert!(is_managed_session_invalid(
            StatusCode::UNAUTHORIZED,
            r#"{"success":false,"error":"Points exhausted"}"#
        ));
    }

    #[test]
    fn treats_session_token_forbidden_response_as_invalid_session() {
        assert!(is_managed_session_invalid(
            StatusCode::FORBIDDEN,
            r#"{"success":false,"error":"Invalid session token"}"#
        ));
    }

    #[test]
    fn ignores_business_forbidden_response() {
        assert!(!is_managed_session_invalid(
            StatusCode::FORBIDDEN,
            r#"{"success":false,"error":"Points exhausted"}"#
        ));
    }

    #[test]
    fn extracts_nested_managed_error_message() {
        assert_eq!(
            managed_api_error_message(
                StatusCode::FORBIDDEN,
                r#"{"error":{"message":"openai_error","type":"bad_response_status_code"}}"#
            ),
            "Managed API failed with status 403: openai_error"
        );
    }
}
