// ── État global ──────────────────────────────────────────────────────────────
const TOKEN_KEY = "safechat_token";
const API_BASE  = "";

let currentUser  = null;
let currentPhone = null;

// ── Utilitaires token ─────────────────────────────────────────────────────────
function getToken()      { return localStorage.getItem(TOKEN_KEY); }
function setToken(t)     { localStorage.setItem(TOKEN_KEY, t); }
function clearToken()    { localStorage.removeItem(TOKEN_KEY); }

// ── Utilitaires DOM ───────────────────────────────────────────────────────────
function showElement(id) { document.getElementById(id).classList.remove("hidden"); }
function hideElement(id) { document.getElementById(id).classList.add("hidden"); }

function showError(message) {
  const el = document.getElementById("login-error");
  el.textContent = message;
  el.classList.remove("hidden");
}

// ── API helper ────────────────────────────────────────────────────────────────
async function apiCall(method, path, body = null, withAuth = true) {
  const headers = { "Content-Type": "application/json" };
  if (withAuth) {
    const token = getToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }

  const options = { method, headers };
  if (body !== null) options.body = JSON.stringify(body);

  const res  = await fetch(`${API_BASE}${path}`, options);
  const data = await res.json().catch(() => ({}));
  return { status: res.status, body: data };
}

// ── Bootstrap : vérifie si déjà connecté ─────────────────────────────────────
async function bootstrap() {
  const token = getToken();
  if (token) {
    const { status, body } = await apiCall("GET", "/auth/me");
    if (status === 200) {
      enterApp(body.user);
      return;
    }
    clearToken();
  }
  showElement("login-section");
  hideElement("app-section");
}

// ── Entrée dans l'app ─────────────────────────────────────────────────────────
function enterApp(user) {
  currentUser = user;
  document.getElementById("user-username").textContent = user.username;
  document.getElementById("user-role").textContent     = user.role;
  hideElement("login-section");
  showElement("app-section");
  // En 8.3 : loadChannels() et loadConversations()
}

// ── Formulaire téléphone ──────────────────────────────────────────────────────
document.getElementById("phone-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const phone = document.getElementById("phone-input").value.trim();

  const { status } = await apiCall("POST", "/auth/send-otp", { phone }, false);
  if (status === 200) {
    currentPhone = phone;
    hideElement("phone-form");
    showElement("otp-form");
    hideElement("login-error");
  } else {
    showError("Numéro invalide");
  }
});

// ── Formulaire OTP ────────────────────────────────────────────────────────────
document.getElementById("otp-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const otp = document.getElementById("otp-input").value.trim();

  const { status, body } = await apiCall(
    "POST",
    "/auth/verify-otp",
    { phone: currentPhone, otp },
    false
  );

  if (status === 200) {
    setToken(body.token);
    enterApp(body.user);
  } else if (status === 401) {
    showError("Code incorrect (essaie 123456)");
  } else {
    showError("Erreur, réessaie");
  }
});

// ── Déconnexion ───────────────────────────────────────────────────────────────
document.getElementById("logout-btn").addEventListener("click", () => {
  clearToken();
  currentUser = null;
  location.reload();
});

// ── Point d'entrée ────────────────────────────────────────────────────────────
bootstrap();
