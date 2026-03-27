use std::collections::HashMap;

use super::credentials_secret_store::{
    delete_secret, read_secret, with_secret_store_lock, write_secret,
};

fn normalize_provider_id(provider_id: &str) -> Option<String> {
    let normalized = provider_id.trim();
    if normalized.is_empty() {
        None
    } else {
        Some(normalized.to_string())
    }
}

fn provider_api_key_account(provider_id: &str) -> Result<String, String> {
    let normalized =
        normalize_provider_id(provider_id).ok_or_else(|| "Provider id is required".to_string())?;
    Ok(format!("ai-provider:{}:api-key", normalized))
}

pub(crate) fn load_ai_provider_api_keys(
    provider_ids: &[String],
) -> Result<HashMap<String, String>, String> {
    with_secret_store_lock(|| {
        let mut secrets = HashMap::new();

        for provider_id in provider_ids {
            let Some(normalized_id) = normalize_provider_id(provider_id) else {
                continue;
            };
            let account = provider_api_key_account(&normalized_id)?;
            if let Some(secret) = read_secret(&account)? {
                secrets.insert(normalized_id, secret);
            }
        }

        Ok(secrets)
    })
}

pub(crate) fn save_ai_provider_api_key(provider_id: &str, api_key: &str) -> Result<(), String> {
    let account = provider_api_key_account(provider_id)?;
    let normalized_key = api_key.trim();

    with_secret_store_lock(|| {
        if normalized_key.is_empty() {
            delete_secret(&account)?;
        } else {
            write_secret(&account, normalized_key)?;
        }
        Ok(())
    })
}

pub(crate) fn delete_ai_provider_api_key(provider_id: &str) -> Result<(), String> {
    let account = provider_api_key_account(provider_id)?;
    with_secret_store_lock(|| {
        delete_secret(&account)?;
        Ok(())
    })
}

#[cfg(test)]
mod tests {
    use super::provider_api_key_account;

    #[test]
    fn builds_provider_api_key_account_name() {
        assert_eq!(
            provider_api_key_account("provider-123").unwrap(),
            "ai-provider:provider-123:api-key"
        );
    }

    #[test]
    fn rejects_blank_provider_id() {
        assert!(provider_api_key_account("   ").is_err());
    }
}
