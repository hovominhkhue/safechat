// ── État global ──────────────────────────────────────────────────────────────
const TOKEN_KEY = "safechat_token";
const API_BASE  = "";

let currentUser          = null;
let currentPhone         = null;
let activeConversationId = null;
let socket               = null;
let isLoadingMore        = false;

const joinedConvs   = new Set();    // convIds déjà joints côté socket
const oldestByConv  = new Map();    // convId → id du plus vieux msg chargé (cursor)
const hasMoreByConv = new Map();    // convId → bool

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

// ── Socket ────────────────────────────────────────────────────────────────────
function connectSocket() {
  socket = io(API_BASE || "/", { auth: { token: getToken() } });
  socket.on("connect",           () => console.log("[socket] connected", socket.id));
  socket.on("connect_error",     (err) => console.error("[socket] error:", err.message));
  socket.on("message:new",       onMessageNew);
  socket.on("conversation:error",(e) => console.warn("[socket] conv error:", e));
}

function onMessageNew(msg) {
  if (msg.conversationId !== activeConversationId) return;
  // Normalise le format socket vers le format API (sender.id/username)
  const normalized = {
    ...msg,
    sender: {
      id:       msg.senderId,
      username: msg.senderId === currentUser?.id
        ? currentUser.username
        : msg.senderId.slice(0, 8),
    },
    status: msg.status || "SENT",
  };
  renderMessage(normalized, false);
  scrollToBottom();
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
  if (user.role === "MODERATOR" || user.role === "ADMIN") {
    showElement("reports-btn");
  }
  hideElement("login-section");
  showElement("app-section");
  connectSocket();
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
      ch.isJoined ? leaveChannel(ch.topic, ch.conversationId) : joinChannel(ch.topic);
    });

    li.appendChild(label);
    li.appendChild(btn);
    list.appendChild(li);
  }
}

async function joinChannel(topic) {
  const { status } = await apiCall("POST", `/channels/${topic}/join`);
  if (status !== 200 && status !== 201) { console.error("joinChannel failed", status); return; }
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

  // Rejoindre le room socket si pas déjà fait
  if (socket && !joinedConvs.has(convId)) {
    socket.emit("conversation:join", { conversationId: convId });
    joinedConvs.add(convId);
  }

  // Charger l'historique initial
  const list = document.getElementById("messages-list");
  list.innerHTML = "";

  const { body } = await apiCall("GET", `/conversations/${convId}/messages?limit=50`);
  const msgs = body.messages || [];

  // L'API renvoie newest→oldest ; on inverse pour afficher oldest en haut
  msgs.reverse().forEach(m => renderMessage(m, false));
  scrollToBottom();

  hasMoreByConv.set(convId, body.hasMore || false);
  if (body.hasMore && body.nextCursor) {
    oldestByConv.set(convId, body.nextCursor);
  }
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

// ── Rendu d'un message ────────────────────────────────────────────────────────
function renderMessage(msg, prepend) {
  const list = document.getElementById("messages-list");

  // Supporte format API (sender.id) et format socket (senderId)
  const senderId   = msg.sender ? msg.sender.id : msg.senderId;
  const senderName = msg.sender ? msg.sender.username : (senderId?.slice(0, 8) ?? "?");
  const isMe       = senderId === currentUser?.id;
  const isBlocked  = msg.status === "BLOCKED";

  const wrapper = document.createElement("div");
  wrapper.className = `group flex items-end gap-2 ${isMe ? "justify-end" : "justify-start"}`;

  const bubble = document.createElement("div");
  bubble.className = [
    "px-3 py-2 rounded-lg max-w-md break-words",
    isMe ? "bg-blue-500 text-white" : "bg-white border",
    isBlocked ? "italic opacity-50" : "",
  ].filter(Boolean).join(" ");

  const content = document.createElement("p");
  content.textContent = isBlocked ? "🚫 Message bloqué par la modération" : msg.content;
  bubble.appendChild(content);

  const meta = document.createElement("p");
  meta.className = `text-[10px] mt-1 ${isMe ? "text-blue-200" : "text-gray-400"}`;
  meta.textContent = `${senderName} · ${new Date(msg.createdAt).toLocaleTimeString()}`;
  bubble.appendChild(meta);

  // Boutons d'action (visibles au hover)
  const actions = document.createElement("div");
  actions.className = "flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity";

  if (!isMe && !isBlocked) {
    const reportBtn = document.createElement("button");
    reportBtn.className = "text-xs text-orange-500 hover:text-orange-700 whitespace-nowrap";
    reportBtn.textContent = "Signaler";
    reportBtn.addEventListener("click", () => reportMessage(msg.id));
    actions.appendChild(reportBtn);
  }

  const isMod = currentUser?.role === "MODERATOR" || currentUser?.role === "ADMIN";
  if (isMod && !isBlocked) {
    const blockBtn = document.createElement("button");
    blockBtn.className = "text-xs text-red-500 hover:text-red-700 whitespace-nowrap";
    blockBtn.textContent = "Bloquer";
    blockBtn.addEventListener("click", () => blockMessage(msg.id));
    actions.appendChild(blockBtn);
  }

  // Actions à gauche de la bulle pour les messages de l'utilisateur courant
  if (isMe) {
    wrapper.appendChild(actions);
    wrapper.appendChild(bubble);
  } else {
    wrapper.appendChild(bubble);
    wrapper.appendChild(actions);
  }

  if (prepend) {
    list.prepend(wrapper);
  } else {
    list.appendChild(wrapper);
  }
}

function scrollToBottom() {
  const list = document.getElementById("messages-list");
  list.scrollTop = list.scrollHeight;
}

// ── Pagination scroll-up ──────────────────────────────────────────────────────
document.getElementById("messages-list").addEventListener("scroll", async () => {
  const list = document.getElementById("messages-list");
  if (list.scrollTop !== 0) return;
  if (!activeConversationId) return;
  if (!hasMoreByConv.get(activeConversationId)) return;
  if (isLoadingMore) return;

  const cursor = oldestByConv.get(activeConversationId);
  if (!cursor) return;

  isLoadingMore = true;
  try {
    const { body } = await apiCall(
      "GET",
      `/conversations/${activeConversationId}/messages?limit=50&before=${cursor}`
    );
    const msgs = body.messages || [];
    const oldHeight = list.scrollHeight;
    msgs.reverse().forEach(m => renderMessage(m, true));
    // Repositionner pour que la vue ne "saute" pas
    list.scrollTop = list.scrollHeight - oldHeight;

    hasMoreByConv.set(activeConversationId, body.hasMore || false);
    if (body.hasMore && body.nextCursor) {
      oldestByConv.set(activeConversationId, body.nextCursor);
    }
  } finally {
    isLoadingMore = false;
  }
});

// ── Envoi de message ──────────────────────────────────────────────────────────
document.getElementById("send-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const input = document.getElementById("message-input");
  const text  = input.value.trim();
  if (!text || !activeConversationId || !socket) return;
  socket.emit("message:send", {
    conversationId:  activeConversationId,
    content:         text,
    clientMessageId: `cli-${Date.now()}`,
  });
  input.value = "";
});

// ── Modération : signaler / bloquer ──────────────────────────────────────────
async function reportMessage(messageId) {
  const reason = prompt("Pourquoi signales-tu ce message ?");
  if (!reason || reason.trim().length < 3) return;
  const { status, body } = await apiCall("POST", "/reports", { messageId, reason: reason.trim() });
  if (status === 201) {
    alert("Message signalé. Merci.");
  } else if (status === 409) {
    alert("Tu as déjà signalé ce message.");
  } else {
    console.error("reportMessage failed", status, body);
    alert("Erreur lors du signalement.");
  }
}

async function blockMessage(messageId) {
  if (!confirm("Bloquer ce message ?")) return;
  const { status, body } = await apiCall("PATCH", `/messages/${messageId}/block`);
  if (status === 200) {
    if (activeConversationId) await selectConversation(activeConversationId);
  } else {
    console.error("blockMessage failed", status, body);
    alert("Erreur lors du blocage.");
  }
}

// ── Modal reports (MOD/ADMIN) ─────────────────────────────────────────────────
async function openReportsModal() {
  const { status, body } = await apiCall("GET", "/moderation/reports?status=OPEN");
  if (status !== 200) { console.error("openReportsModal failed", status); return; }

  const reportsList = document.getElementById("reports-list");
  reportsList.innerHTML = "";

  if (body.total === 0) {
    const empty = document.createElement("p");
    empty.className = "text-gray-500 text-center py-4";
    empty.textContent = "Aucun signalement ouvert.";
    reportsList.appendChild(empty);
  } else {
    for (const report of body.reports) {
      const li = document.createElement("li");
      li.className = "border-b pb-3";

      const header = document.createElement("p");
      header.className = "text-sm";
      const r = document.createElement("strong");
      r.textContent = report.reporter?.username ?? "?";
      const s = document.createElement("strong");
      s.textContent = report.message?.sender?.username ?? "?";
      header.appendChild(r);
      header.append(" a signalé ");
      header.appendChild(s);

      const reason = document.createElement("p");
      reason.className = "text-xs text-gray-500 mt-1";
      reason.textContent = `Raison : ${report.reason}`;

      const msgContent = document.createElement("p");
      msgContent.className = "bg-gray-100 p-2 rounded text-sm mt-1";
      msgContent.textContent = `"${report.message?.content ?? "—"}"`;

      const blockBtn = document.createElement("button");
      blockBtn.className = "mt-2 bg-red-600 text-white px-3 py-1 rounded text-xs";
      blockBtn.textContent = "Bloquer le message";
      blockBtn.addEventListener("click", async () => {
        await blockMessage(report.message.id);
        hideElement("reports-modal");
        await openReportsModal();
      });

      li.appendChild(header);
      li.appendChild(reason);
      li.appendChild(msgContent);
      li.appendChild(blockBtn);
      reportsList.appendChild(li);
    }
  }

  showElement("reports-modal");
}

document.getElementById("reports-btn").addEventListener("click", openReportsModal);
document.getElementById("close-reports-btn").addEventListener("click", () => hideElement("reports-modal"));

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
  if (socket) socket.disconnect();
  clearToken();
  currentUser = null;
  location.reload();
});

// ── Point d'entrée ────────────────────────────────────────────────────────────
bootstrap();
