use keyring::{Entry, Error};
use std::sync::{Mutex, OnceLock};

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct AccountSecretBundle {
    pub app_session_token: String,
}

pub(crate) const SECRET_SERVICE_NAME: &str = "NekoTick";
pub(crate) const SESSION_TOKEN_ACCOUNT: &str = "managed-session-token";

fn secret_store_lock() -> &'static Mutex<()> {
    static LOCK: OnceLock<Mutex<()>> = OnceLock::new();
    LOCK.get_or_init(|| Mutex::new(()))
}

fn with_secret_store_lock<T>(operation: impl FnOnce() -> Result<T, String>) -> Result<T, String> {
    let _guard = secret_store_lock()
        .lock()
        .map_err(|_| "Credential store lock poisoned".to_string())?;
    operation()
}

fn secret_entry(account: &str) -> Result<Entry, String> {
    Entry::new(SECRET_SERVICE_NAME, account).map_err(|e| e.to_string())
}

fn read_secret(account: &str) -> Result<Option<String>, String> {
    let entry = secret_entry(account)?;
    match entry.get_password() {
        Ok(value) => {
            let normalized = value.trim().to_string();
            if normalized.is_empty() {
                Ok(None)
            } else {
                Ok(Some(value))
            }
        }
        Err(Error::NoEntry) => Ok(None),
        Err(error) => Err(error.to_string()),
    }
}

fn write_secret(account: &str, value: &str) -> Result<(), String> {
    let entry = secret_entry(account)?;
    entry.set_password(value).map_err(|e| e.to_string())
}

fn delete_secret(account: &str) -> Result<(), String> {
    let entry = secret_entry(account)?;
    match entry.delete_credential() {
        Ok(()) | Err(Error::NoEntry) => Ok(()),
        Err(error) => Err(error.to_string()),
    }
}

pub(crate) fn load_secret_bundle() -> Result<Option<AccountSecretBundle>, String> {
    with_secret_store_lock(|| {
        let app_session_token = match read_secret(SESSION_TOKEN_ACCOUNT)? {
            Some(value) => value,
            None => return Ok(None),
        };

        Ok(Some(AccountSecretBundle { app_session_token }))
    })
}

pub(crate) fn save_secret_bundle(bundle: &AccountSecretBundle) -> Result<(), String> {
    with_secret_store_lock(|| {
        write_secret(SESSION_TOKEN_ACCOUNT, &bundle.app_session_token)?;
        Ok(())
    })
}

pub(crate) fn delete_secret_bundle() -> Result<(), String> {
    with_secret_store_lock(|| {
        delete_secret(SESSION_TOKEN_ACCOUNT)?;
        Ok(())
    })
}
