# Auth Full Rebuild Plan

## Target End State

NekoTick will move to a three-layer auth model:

1. Primary account identity
- Google OAuth
- Email verification code sign-in
- This is the default login path for desktop and web

2. App session
- Provider-agnostic session token issued by the NekoTick API
- Shared by desktop, web, and managed AI access
- No product logic should depend on GitHub-specific identifiers

3. External connectors
- GitHub becomes an optional connected account
- GitHub sync lives in Settings as an advanced capability
- GitHub is not required for first-run, normal editing, or AI access

## Product Rules

- Local-first remains the default product behavior
- Notes and workspace data remain local unless the user explicitly enables a sync connector
- GitHub cannot be the primary entry gate
- Web must work as an account surface even before full editor parity exists
- AI access is tied to the NekoTick account, not to GitHub identity

## Architecture Changes

### API

The API must be rebuilt around a generic account model.

Current problem:
- `users` is keyed by `github_id`
- `app_sessions` and AI access tables all reference GitHub identity directly
- OAuth flows are hard-coded around GitHub

Target model:
- `users(id, primary_email, display_name, avatar_url, registered_at, updated_at)`
- `auth_identities(id, user_id, provider, provider_user_id, email, email_verified, created_at, updated_at)`
- `oauth_states(state, provider, flow, expires_at, consumed_at, created_at)`
- `desktop_oauth_sessions(state, provider, status, app_session_token, identity_payload_json, error_message, created_at, completed_at)`
- `web_oauth_sessions(state, provider, status, app_session_token, identity_payload_json, error_message, created_at, completed_at)`
- `email_login_codes(code_hash, user_id, email, expires_at, consumed_at, attempt_count, last_attempt_at, created_at)`
- `app_sessions(token_hash, user_id, created_at, expires_at, last_used_at, client_ip, user_agent)`

AI tables should reference `users(id)` only.

### Frontend / Desktop

The app must stop treating GitHub as the product account.

Historical problem:
- Account store is still named `githubSync`
- Settings text still treats GitHub as the account provider
- Managed AI previously assumed GitHub-backed identity

Target model:
- `accountSession` store owns the active NekoTick account session
- Provider metadata is additive (`github`, `google`, `email`)
- Connected services are displayed separately in Settings
- GitHub sync UI lives under a dedicated advanced sync section

### Tauri

Desktop secure storage must use account session storage instead of provider-specific credential naming.

Current problem:
- keyring metadata and token storage are GitHub-specific
- managed session token persistence is tied to GitHub credential objects

Target model:
- account session token stored independently
- external provider metadata stored separately
- GitHub connector tokens stored only if sync is enabled

## Delivery Order

### Phase 1: account boundary split
- Introduce provider-agnostic account session store on the frontend
- Stop exposing GitHub as the primary account concept in shared UI
- Keep GitHub as the temporary underlying provider while the new providers are added

### Phase 2: API identity rebuild
- Replace `github_id`-centric tables with generic user and identity tables
- Rewire AI access and session code to `user_id`
- Add provider-aware auth flow helpers

### Phase 3: Google sign-in
- Add Google OAuth start/callback/result flows for web and desktop
- Map Google identity to generic `auth_identities`
- Issue normal app sessions after Google sign-in

### Phase 4: email verification code
- Add email sign-in request and verify endpoints
- Send 6-digit verification codes through Resend
- Issue normal app sessions after email verification

### Phase 5: GitHub connector and sync
- Reintroduce GitHub as a connected service in Settings
- Rebuild GitHub sync on top of the local-first workspace model
- Ensure GitHub sync is opt-in and never required for account access

## External Integrations

### Google OAuth
- Use standard OpenID Connect authorization code flow
- Required scopes: `openid email profile`
- Google becomes a primary account provider, not a sync backend

### Email verification code
- Use Resend as the initial delivery provider for Worker compatibility
- Delivery must be abstracted behind an email sender interface so provider swap is cheap

### GitHub
- Keep GitHub OAuth or GitHub App only for connector/sync needs
- Do not mix GitHub repository permissions with base account login

## Definition of Done

This rebuild is complete only when:

- A new user can sign in without GitHub
- GitHub is no longer required for AI access
- All server-side user/session logic is provider-agnostic
- GitHub appears under optional connected services / sync
- Desktop, web, and API wording no longer treat GitHub as the product account
- Database schema no longer uses `github_id` as the root user identifier
