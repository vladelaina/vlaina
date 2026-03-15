use std::collections::HashMap;

use super::ai_secret_store::{
    delete_ai_provider_api_key, load_ai_provider_api_keys, save_ai_provider_api_key,
};

#[tauri::command]
pub async fn get_ai_provider_secrets(
    provider_ids: Vec<String>,
) -> Result<HashMap<String, String>, String> {
    load_ai_provider_api_keys(&provider_ids)
}

#[tauri::command]
pub async fn set_ai_provider_secret(provider_id: String, api_key: String) -> Result<(), String> {
    save_ai_provider_api_key(&provider_id, &api_key)
}

#[tauri::command]
pub async fn delete_ai_provider_secret(provider_id: String) -> Result<(), String> {
    delete_ai_provider_api_key(&provider_id)
}
