// ── État global ──────────────────────────────────────────────────────────────
const TOKEN_KEY = "safechat_token";
const API_BASE  = "";

let currentUser          = null;
let currentPhone         = null;
let activeConversationId = null;

// ── Utilitaires token ─────────────────────────────────────────────────────────
function getToken()   { return localStorage.getItem(TOKEN_KEY); }
function setToken(t)  { localStorage.setItem(TOKEN_KEY, t); }
function clearToken() { localStorage.removeItem(TOKEN_KEY); }

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

// ── Bootstrap ─────────────────────────────────────────────────────────────────
async function bootstrap() {
  const token = getToken();
  if (token) {
    const { status, body } = await apiCall("GET", "/auth/me");
    if (status === 200) {
      await enterApp(body.user);
      return;
    }
    clearToken();
  }
  showElement("login-section");
  hideElement("app-section");
}

// ── Entrée dans l'app ─────────────────────────────────────────────────────────
async function enterApp(user) {
  currentUser = user;
  document.getElementById("user-username").textContent = user.username;
  document.getElementById("user-role").textContent     = user.role;
  document.getElementById("user-id").textContent       = user.id;
  hideElement("login-section");
  showElement("app-section");
  await loadChannels();
  await loadConversations();
}

// ── Channels ──────────────────────────────────────────────────────────────────
async function loadChannels() {
  const { status, body } = await apiCall("GET", "/channels");
  if (status !== 200) { console.error("loadChannels failed", status); return; }

  const list = document.getElementById("channels-list");
  list.innerHTML = "";

  for (const ch of body.channels) {
    const isActive = ch.conversationId && ch.conversationId === activeConversationId;

    const li = document.createElement("li");
    li.className = [
      "flex items-center justify-between px-2 py-1 rounded text-sm",
      ch.isJoined ? "bg-blue-100" : "bg-gray-50 hover:bg-gray-100",
      isActive ? "ring-2 ring-blue-500" : "",
    ].filter(Boolean).join(" ");

    const label = document.createElement("span");
    label.className = "flex-1 truncate";
    label.textContent = `# ${ch.topic} (${ch.name})`;
    if (ch.isJoined && ch.conversationId) {
      label.classList.add("cursor-pointer");
      label.addEventListener("click", () => selectConversation(ch.conversationId));
    }

    const btn = document.createElement("button");
    btn.className = `ml-2 text-xs font-bold px-1.5 rounded ${
      ch.isJoined ? "text-blue-600 hover:text-red-500" : "text-green-600 hover:text-green-800"
    }`;
    btn.textContent = ch.isJoined ? "×" : "+";
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      ch.isJoined
        ? leaveChannel(ch.topic, ch.conversationId)
        : joinChannel(ch.topic);
    });

    li.appendChild(label);
    li.appendChild(btn);
    list.appendChild(li);
  }
}

async function joinChannel(topic) {
  const { status } = await apiCall("POST", `/channels/${topic}/join`);
  if (status !== 200 && status !== 201) {
    console.error("joinChannel failed", status);
    return;
  }
  await loadChannels();
  await loadConversations();
}

async function leaveChannel(topic, conversationId) {
  const { status } = await apiCall("DELETE", `/channels/${topic}/leave`);
  if (status !== 200) { console.error("leaveChannel failed", status); return; }
  if (conversationId === activeConversationId) {
    activeConversationId = null;
    updateChatHeader(null);
    hideElement("chat-input-bar");
  }
  await loadChannels();
  await loadConversations();
}

// ── Conversations ─────────────────────────────────────────────────────────────
async function loadConversations() {
  const { status, body } = await apiCall("GET", "/conversations");
  if (status !== 200) { console.error("loadConversations failed", status); return; }

  const list = document.getElementById("conversations-list");
  list.innerHTML = "";

  const convs = body.conversations.filter(c => c.type === "DM" || c.type === "GROUP");

  for (const conv of convs) {
    const isActive = conv.id === activeConversationId;

    const li = document.createElement("li");
    li.className = [
      "px-2 py-1 rounded cursor-pointer text-sm",
      "bg-gray-50 hover:bg-gray-100",
      isActive ? "ring-2 ring-blue-500" : "",
    ].filter(Boolean).join(" ");

    const nameEl = document.createElement("p");
    nameEl.className = "font-medium";
    nameEl.textContent = conv.type === "DM"
      ? `@ DM ${conv.id.slice(0, 6)}`
      : `# ${conv.name || "Groupe"}`;
    li.appendChild(nameEl);

    if (conv.lastMessagePreview) {
      const preview = document.createElement("p");
      preview.className = "text-xs text-gray-400 truncate";
      preview.textContent = conv.lastMessagePreview;
      li.appendChild(preview);
    }

    li.addEventListener("click", () => selectConversation(conv.id));
    list.appendChild(li);
  }
}

// ── Sélection d'une conversation ──────────────────────────────────────────────
async function selectConversation(convId) {
  activeConversationId = convId;
  await loadChannels();
  await loadConversations();
  updateChatHeader(convId);
  showElement("chat-input-bar");
  const msgEl = document.getElementById("messages-list");
  msgEl.innerHTML = "";
  const placeholder = document.createElement("p");
  placeholder.className = "text-gray-400 text-center py-8";
  placeholder.textContent = "Messages à venir en 8.4";
  msgEl.appendChild(placeholder);
}

function updateChatHeader(convId) {
  const header = document.getElementById("chat-header");
  header.innerHTML = "";
  const p = document.createElement("p");
  if (!convId) {
    p.className = "text-gray-400";
    p.textContent = "Sélectionne une conversation";
  } else {
    p.className = "font-semibold";
    p.textContent = `Conversation ${convId.slice(0, 8)}`;
  }
  header.appendChild(p);
}

// ── Nouveau DM ────────────────────────────────────────────────────────────────
document.getElementById("new-dm-btn").addEventListener("click", async () => {
  const otherUserId = prompt("ID de l'utilisateur ?");
  if (!otherUserId || !otherUserId.trim()) return;
  const { status } = await apiCall("POST", "/conversations/dm", { otherUserId: otherUserId.trim() });
  if (status !== 200 && status !== 201) {
    alert("Erreur lors de la création du DM (ID invalide ?)");
    return;
  }
  await loadConversations();
});

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
    "POST", "/auth/verify-otp",
    { phone: currentPhone, otp },
    false
  );
  if (status === 200) {
    setToken(body.token);
    await enterApp(body.user);
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
