// ==================== Configuration ====================
const API_BASE = 'https://api.nekotick.com';

// ==================== State ====================
let currentUser = null;

// ==================== DOM Elements ====================
const loginPrompt = document.getElementById('login-prompt');
const userInfo = document.getElementById('user-info');
const userAvatar = document.getElementById('user-avatar');
const userName = document.getElementById('user-name');
const purchaseBtn = document.getElementById('purchase-btn');
const statusMessage = document.getElementById('status-message');

// ==================== Initialization ====================
document.addEventListener('DOMContentLoaded', () => {
  // Check URL parameters for OAuth callback or payment status
  const params = new URLSearchParams(window.location.search);
  
  // Handle OAuth callback
  const authCode = params.get('auth_code');
  if (authCode) {
    handleOAuthCallback(authCode);
    // Clean URL
    window.history.replaceState({}, '', window.location.pathname);
    return;
  }

  // Handle OAuth error
  const authError = params.get('auth_error');
  if (authError) {
    showStatus('GitHub login failed. Please try again.', 'error');
    window.history.replaceState({}, '', window.location.pathname);
    return;
  }

  // Handle payment success
  if (params.get('success') === 'true') {
    showStatus('Payment successful! You are now a PRO user. 🎉', 'success');
    window.history.replaceState({}, '', window.location.pathname);
  }

  // Handle payment cancelled
  if (params.get('cancelled') === 'true') {
    showStatus('Payment was cancelled.', 'error');
    window.history.replaceState({}, '', window.location.pathname);
  }

  // Restore session from localStorage
  restoreSession();
});

// ==================== Session Management ====================
function restoreSession() {
  const savedUser = localStorage.getItem('nekotick_user');
  if (savedUser) {
    try {
      currentUser = JSON.parse(savedUser);
      showUserInfo();
    } catch (e) {
      localStorage.removeItem('nekotick_user');
    }
  }
}

function saveSession(user) {
  currentUser = user;
  localStorage.setItem('nekotick_user', JSON.stringify(user));
}

function clearSession() {
  currentUser = null;
  localStorage.removeItem('nekotick_user');
}


// ==================== UI Functions ====================
function showUserInfo() {
  if (!currentUser) return;
  
  loginPrompt.classList.add('hidden');
  userInfo.classList.remove('hidden');
  
  userAvatar.src = currentUser.avatarUrl || '';
  userAvatar.alt = currentUser.username;
  userName.textContent = currentUser.username;
}

function showLoginPrompt() {
  userInfo.classList.add('hidden');
  loginPrompt.classList.remove('hidden');
}

function showStatus(message, type = 'info') {
  statusMessage.textContent = message;
  statusMessage.className = `status-message ${type}`;
  statusMessage.classList.remove('hidden');
  
  // Auto-hide after 5 seconds for non-error messages
  if (type !== 'error') {
    setTimeout(() => {
      statusMessage.classList.add('hidden');
    }, 5000);
  }
}

function hideStatus() {
  statusMessage.classList.add('hidden');
}

function setLoading(button, loading) {
  if (loading) {
    button.disabled = true;
    button.dataset.originalText = button.textContent;
    button.textContent = 'Loading...';
  } else {
    button.disabled = false;
    button.textContent = button.dataset.originalText || button.textContent;
  }
}

// ==================== GitHub OAuth ====================
async function startGitHubAuth() {
  const btn = document.getElementById('github-login-btn');
  setLoading(btn, true);
  hideStatus();

  try {
    const response = await fetch(`${API_BASE}/auth/github`);
    const data = await response.json();

    if (!data.authUrl) {
      throw new Error('Failed to get auth URL');
    }

    // Redirect to GitHub OAuth
    window.location.href = data.authUrl;
  } catch (error) {
    console.error('OAuth error:', error);
    showStatus('Failed to start GitHub login. Please try again.', 'error');
    setLoading(btn, false);
  }
}

async function handleOAuthCallback(code) {
  showStatus('Completing login...', 'info');

  try {
    const response = await fetch(`${API_BASE}/auth/github/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    });

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'Token exchange failed');
    }

    // Save user session
    saveSession({
      username: data.username,
      avatarUrl: data.avatarUrl,
      accessToken: data.accessToken,
    });

    showUserInfo();
    hideStatus();
  } catch (error) {
    console.error('OAuth callback error:', error);
    showStatus('Login failed. Please try again.', 'error');
  }
}

// ==================== Checkout ====================
async function startCheckout() {
  if (!currentUser) {
    showStatus('Please sign in with GitHub first.', 'error');
    return;
  }

  setLoading(purchaseBtn, true);
  hideStatus();

  try {
    const response = await fetch(`${API_BASE}/checkout/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ github_username: currentUser.username }),
    });

    const data = await response.json();

    if (!data.success) {
      if (data.error === 'RATE_LIMITED') {
        throw new Error('Too many requests. Please wait a moment.');
      }
      throw new Error(data.error || 'Failed to create checkout');
    }

    // Redirect to Stripe Checkout
    window.location.href = data.checkoutUrl;
  } catch (error) {
    console.error('Checkout error:', error);
    showStatus(error.message || 'Failed to start checkout. Please try again.', 'error');
    setLoading(purchaseBtn, false);
  }
}

// ==================== Logout ====================
function logout() {
  clearSession();
  showLoginPrompt();
  hideStatus();
}
