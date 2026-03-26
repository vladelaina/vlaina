use crate::account::{
    credentials_meta_store::{
        delete_account_meta, load_account_meta, save_account_meta, AccountMeta,
    },
    credentials_secret_store::{
        delete_secret_bundle, load_secret_bundle, save_secret_bundle, AccountSecretBundle,
    },
};
use serde::{Deserialize, Serialize};
use tauri::Manager;

pub const APP_CONFIG_FOLDER: &str = ".vlaina";
pub const STORE_FOLDER: &str = "store";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub(crate) struct AccountCredentials {
    pub app_session_token: String,
    pub provider: String,
    pub username: String,
    #[serde(default)]
    pub primary_email: Option<String>,
    #[serde(default)]
    pub avatar_url: Option<String>,
}

pub fn get_data_dir(app: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    app.path().app_data_dir().map_err(|e| e.to_string())
}

fn store_dir(app: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    let mut path = get_data_dir(app)?;
    path.push(APP_CONFIG_FOLDER);
    path.push(STORE_FOLDER);
    Ok(path)
}

fn to_account_meta(creds: &AccountCredentials) -> AccountMeta {
    AccountMeta {
        provider: Some(creds.provider.clone()),
        username: creds.username.clone(),
        primary_email: creds.primary_email.clone(),
        avatar_url: creds.avatar_url.clone(),
    }
}

fn to_secret_bundle(creds: &AccountCredentials) -> AccountSecretBundle {
    AccountSecretBundle {
        app_session_token: creds.app_session_token.clone(),
    }
}

fn join_credentials(meta: AccountMeta, secrets: AccountSecretBundle) -> Option<AccountCredentials> {
    let provider = match meta.provider.as_deref() {
        Some("github") | Some("google") | Some("email") => meta.provider?,
        _ => return None,
    };
    let username = meta.username.trim().to_string();
    if username.is_empty() {
        return None;
    }

    Some(AccountCredentials {
        app_session_token: secrets.app_session_token,
        provider,
        username,
        primary_email: meta.primary_email,
        avatar_url: meta.avatar_url,
    })
}

pub(crate) fn load_account_credentials(app: &tauri::AppHandle) -> Option<AccountCredentials> {
    let store_dir = store_dir(app).ok()?;
    let meta = load_account_meta(&store_dir)?;
    let secrets = load_secret_bundle().ok().flatten()?;
    join_credentials(meta, secrets)
}

pub(crate) fn save_account_credentials(
    app: &tauri::AppHandle,
    creds: &AccountCredentials,
) -> Result<(), String> {
    let store_dir = store_dir(app)?;
    save_secret_bundle(&to_secret_bundle(creds))?;
    if let Err(error) = save_account_meta(&store_dir, &to_account_meta(creds)) {
        let _ = delete_secret_bundle();
        return Err(error);
    }
    Ok(())
}

pub fn delete_account_credentials(app: &tauri::AppHandle) -> Result<(), String> {
    let store_dir = store_dir(app)?;
    delete_secret_bundle()?;
    delete_account_meta(&store_dir)?;
    Ok(())
}

pub fn get_stored_app_session_token(app: &tauri::AppHandle) -> Option<String> {
    load_account_credentials(app).map(|c| c.app_session_token)
}

pub fn update_stored_app_session_token(
    app: &tauri::AppHandle,
    app_session_token: String,
) -> Result<(), String> {
    let mut creds =
        load_account_credentials(app).ok_or_else(|| "Account credentials not found".to_string())?;
    creds.app_session_token = app_session_token;
    save_account_credentials(app, &creds)
}

#[cfg(test)]
mod tests {
    use super::{join_credentials, to_account_meta, to_secret_bundle, AccountCredentials};
    use crate::account::credentials_meta_store::AccountMeta;
    use crate::account::credentials_secret_store::AccountSecretBundle;

    #[test]
    fn converts_full_credentials_to_account_meta() {
        let creds = AccountCredentials {
            app_session_token: "session".to_string(),
            provider: "google".to_string(),
            username: "octocat".to_string(),
            primary_email: Some("octocat@example.com".to_string()),
            avatar_url: Some("https://example.com/avatar.png".to_string()),
        };

        let meta = to_account_meta(&creds);
        assert_eq!(meta.provider.as_deref(), Some("google"));
        assert_eq!(meta.username, "octocat");
        assert_eq!(meta.primary_email.as_deref(), Some("octocat@example.com"));
        assert_eq!(
            meta.avatar_url.as_deref(),
            Some("https://example.com/avatar.png")
        );
    }

    #[test]
    fn converts_full_credentials_to_secret_bundle() {
        let creds = AccountCredentials {
            app_session_token: "session".to_string(),
            provider: "github".to_string(),
            username: "octocat".to_string(),
            primary_email: None,
            avatar_url: None,
        };

        let bundle = to_secret_bundle(&creds);
        assert_eq!(bundle.app_session_token, "session");
    }

    #[test]
    fn rejects_credentials_without_supported_provider() {
        let meta = AccountMeta {
            provider: None,
            username: "octocat".to_string(),
            primary_email: None,
            avatar_url: None,
        };
        let secrets = AccountSecretBundle {
            app_session_token: "session".to_string(),
        };

        assert!(join_credentials(meta, secrets).is_none());
    }

    #[test]
    fn rejects_credentials_with_blank_username() {
        let meta = AccountMeta {
            provider: Some("google".to_string()),
            username: "   ".to_string(),
            primary_email: None,
            avatar_url: None,
        };
        let secrets = AccountSecretBundle {
            app_session_token: "session".to_string(),
        };

        assert!(join_credentials(meta, secrets).is_none());
    }
}
