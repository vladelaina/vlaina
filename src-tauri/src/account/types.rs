use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AccountSessionStatus {
    pub connected: bool,
    pub provider: Option<String>,
    pub username: Option<String>,
    pub primary_email: Option<String>,
    pub avatar_url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AccountAuthResult {
    pub success: bool,
    pub provider: Option<String>,
    pub username: Option<String>,
    pub primary_email: Option<String>,
    pub avatar_url: Option<String>,
    pub error: Option<String>,
}
