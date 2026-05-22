// ── État global ──────────────────────────────────────────────────────────────
const TOKEN_KEY = "safechat_token";
const API_BASE = "";

let currentUser = null;
let currentPhone = null;
let activeConversationId = null;
let socket = null;
let isLoadingMore = false;

const joinedConvs = new Set();
const oldestByConv = new Map();
const hasMoreByConv = new Map();
const renderedMessageIds = new Set();
const conversationNames = new Map();

// ── Token ────────────────────────────────────────────────────────────────────
function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

// ── DOM ──────────────────────────────────────────────────────────────────────
function showElement(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove("hidden");
}

function hideElement(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add("hidden");
}

function showError(message) {
  const el = document.getElementById("login-error");
  el.textContent = message;
  el.classList.remove("hidden");
}

// ── API ──────────────────────────────────────────────────────────────────────
async function apiCall(method, path, body = null, withAuth = true) {
  const headers = { "Content-Type": "application/json" };

  if (withAuth) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const options = { method, headers };
  if (body !== null) options.body = JSON.stringify(body);

  const res = await fetch(`${API_BASE}${path}`, options);

  let data = {};
  try {
    data = await res.json();
  } catch {}

  return { status: res.status, body: data };
}

// ── Socket ───────────────────────────────────────────────────────────────────
function connectSocket() {
  if (socket) socket.disconnect();

  socket = io(API_BASE || "/", {
    auth: { token: getToken() },
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
  });

  socket.on("connect", () => {
    console.log("[socket] connected", socket.id);

    if (activeConversationId && !joinedConvs.has(activeConversationId)) {
      socket.emit("conversation:join", { conversationId: activeConversationId });
      joinedConvs.add(activeConversationId);
    }
  });

  socket.on("connect_error", (err) => {
    console.error("[socket] error:", err.message);
  });

  socket.on("conversation:joined", (data) => {
    console.log("[socket] joined conversation", data);
  });

  socket.on("conversation:error", (err) => {
    console.warn("[socket] conversation error:", err);
  });

  socket.on("message:new", onMessageNew);

  socket.on("message:ack", (ack) => {
    console.log("[socket] message ack:", ack);
  });

  socket.on("message:error", (err) => {
    console.error("[socket] message error:", err);
    alert("Erreur lors de l'envoi du message.");
  });
}

function onMessageNew(msg) {
  if (msg.conversationId !== activeConversationId) return;
  if (msg.id && renderedMessageIds.has(msg.id)) return;

  const senderId = msg.sender?.id || msg.senderId;

  const normalized = {
    ...msg,
    sender: {
      id: senderId,
      username:
        msg.sender?.username ||
        (senderId === currentUser?.id
          ? currentUser.username
          : senderId?.slice(0, 8) || "?"),
    },
    status: msg.status || "SENT",
    createdAt: msg.createdAt || new Date().toISOString(),
  };

  renderMessage(normalized, false);
  scrollToBottom();
}

// ── Bootstrap ────────────────────────────────────────────────────────────────
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

  showElement("home-section");
  hideElement("login-section");
  hideElement("app-section");
}

// ── Page accueil → login ─────────────────────────────────────────────────────
function initHomeButtons() {
  const openLogin = () => {
    hideElement("home-section");
    showElement("login-section");
    hideElement("app-section");
  };

  document.getElementById("go-login-btn")?.addEventListener("click", openLogin);
  document.getElementById("go-start-btn")?.addEventListener("click", openLogin);
  document.getElementById("hero-start-btn")?.addEventListener("click", openLogin);
  document.getElementById("hero-demo-btn")?.addEventListener("click", openLogin);
}

// ── Entrée app ───────────────────────────────────────────────────────────────
async function enterApp(user) {
  currentUser = user;

  document.getElementById("user-username").textContent =
    user.username || user.phone || "Utilisateur";
  document.getElementById("user-role").textContent = user.role || "USER";
  document.getElementById("user-id").textContent = user.id;

  if (user.role === "MODERATOR" || user.role === "ADMIN") {
    showElement("reports-btn");
  } else {
    hideElement("reports-btn");
  }

  hideElement("home-section");
  hideElement("login-section");
  showElement("app-section");

  connectSocket();

  await loadChannels();
  await loadConversations();
}

// ── Channels ─────────────────────────────────────────────────────────────────
async function loadChannels() {
  const { status, body } = await apiCall("GET", "/channels");

  if (status !== 200) {
    console.error("loadChannels failed", status, body);
    return;
  }

  const list = document.getElementById("channels-list");
  list.innerHTML = "";

  const channels = body.channels || [];

  for (const ch of channels) {
    const isActive = ch.conversationId === activeConversationId;

    const li = document.createElement("li");
    li.className = [
      "flex items-center justify-between px-3 py-1.5 rounded-lg text-sm cursor-pointer transition-colors",
      isActive
        ? "bg-violet-600 text-white"
        : ch.isJoined
        ? "text-slate-200 hover:bg-slate-800"
        : "text-slate-500 hover:bg-slate-900",
    ]
      .filter(Boolean)
      .join(" ");

    const label = document.createElement("span");
    label.className = "flex-1 truncate";
    label.textContent = `# ${ch.topic || ch.name}`;

    if (ch.isJoined && ch.conversationId) {
      conversationNames.set(ch.conversationId, `# ${ch.topic || ch.name}`);
      label.classList.add("cursor-pointer");
      label.addEventListener("click", () => selectConversation(ch.conversationId));
    }

    const btn = document.createElement("button");
    btn.className = `ml-2 text-xs font-bold px-1.5 py-0.5 rounded transition-colors ${
      ch.isJoined
        ? isActive
          ? "text-violet-200 hover:text-red-300"
          : "text-slate-400 hover:text-red-400"
        : "text-violet-400 hover:text-violet-300"
    }`;
    btn.textContent = ch.isJoined ? "×" : "+";

    btn.addEventListener("click", async (e) => {
      e.stopPropagation();

      if (ch.isJoined) {
        await leaveChannel(ch.topic, ch.conversationId);
      } else {
        await joinChannel(ch.topic);
      }
    });

    li.appendChild(label);
    li.appendChild(btn);
    list.appendChild(li);
  }
}

async function joinChannel(topic) {
  const { status, body } = await apiCall("POST", `/channels/${topic}/join`);

  if (![200, 201].includes(status)) {
    console.error("joinChannel failed", status, body);
    alert("Erreur lors de l'adhésion au channel.");
    return;
  }

  await loadChannels();
  await loadConversations();
}

async function leaveChannel(topic, conversationId) {
  const { status, body } = await apiCall("DELETE", `/channels/${topic}/leave`);

  if (status !== 200) {
    console.error("leaveChannel failed", status, body);
    alert("Erreur lors de la sortie du channel.");
    return;
  }

  if (conversationId === activeConversationId) {
    activeConversationId = null;
    updateChatHeader(null);
    hideElement("chat-input-bar");
    document.getElementById("messages-list").innerHTML = "";
  }

  await loadChannels();
  await loadConversations();
}

// ── Conversations ────────────────────────────────────────────────────────────
async function loadConversations() {
  const { status, body } = await apiCall("GET", "/conversations");

  if (status !== 200) {
    console.error("loadConversations failed", status, body);
    return;
  }

  const list = document.getElementById("conversations-list");
  list.innerHTML = "";

  const conversations = body.conversations || body || [];
  const convs = Array.isArray(conversations)
    ? conversations.filter((c) => c.type === "DM" || c.type === "GROUP")
    : [];

  for (const conv of convs) {
    const convId = conv.id || conv._id;
    const isActive = convId === activeConversationId;

    const li = document.createElement("li");
    li.className = [
      "px-3 py-2 rounded-lg cursor-pointer text-sm transition-colors",
      isActive ? "bg-violet-600 text-white" : "text-slate-300 hover:bg-slate-800",
    ]
      .filter(Boolean)
      .join(" ");

    const nameEl = document.createElement("p");
    nameEl.className = `font-medium ${isActive ? "text-white" : ""}`;

    const other = conv.participants?.find(
      (p) => (p.id || p._id) !== currentUser?.id
    );

    const displayName =
      conv.type === "DM"
        ? `@ ${
            other?.username ||
            other?.phone ||
            other?.id?.slice(0, 6) ||
            convId.slice(0, 6)
          }`
        : `# ${conv.name || "Groupe"}`;

    nameEl.textContent = displayName;
    conversationNames.set(convId, displayName);

    li.appendChild(nameEl);

    if (conv.lastMessagePreview) {
      const preview = document.createElement("p");
      preview.className = `text-xs truncate mt-0.5 ${isActive ? "text-violet-200" : "text-slate-500"}`;
      preview.textContent = conv.lastMessagePreview;
      li.appendChild(preview);
    }

    li.addEventListener("click", () => selectConversation(convId));
    list.appendChild(li);
  }
}

// ── Sélection conversation ───────────────────────────────────────────────────
async function selectConversation(convId) {
  activeConversationId = convId;
  renderedMessageIds.clear();

  await loadChannels();
  await loadConversations();

  updateChatHeader(convId);
  showElement("chat-input-bar");

  if (socket && !joinedConvs.has(convId)) {
    socket.emit("conversation:join", { conversationId: convId });
    joinedConvs.add(convId);
  }

  const list = document.getElementById("messages-list");
  list.innerHTML = "";

  const { status, body } = await apiCall(
    "GET",
    `/conversations/${convId}/messages?limit=50`
  );

  if (status !== 200) {
    console.error("load messages failed", status, body);
    alert("Erreur lors du chargement des messages.");
    return;
  }

  const msgs = body.messages || [];
  msgs.reverse().forEach((m) => renderMessage(m, false));

  scrollToBottom();

  hasMoreByConv.set(convId, body.hasMore || false);

  if (body.hasMore && body.nextCursor) {
    oldestByConv.set(convId, body.nextCursor);
  } else {
    oldestByConv.delete(convId);
  }
}

function updateChatHeader(convId) {
  const header = document.getElementById("chat-header");
  header.innerHTML = "";

  if (!convId) {
    const p = document.createElement("p");
    p.className = "text-gray-400 text-sm";
    p.textContent = "Sélectionne une conversation";
    header.appendChild(p);
    showElement("empty-state");
    return;
  }

  hideElement("empty-state");

  const wrapper = document.createElement("div");
  wrapper.className = "flex items-center gap-3";

  const displayName = conversationNames.get(convId) || `Conversation ${convId.slice(0, 8)}`;
  const iconChar = displayName.startsWith("@") ? "@" : "#";

  const icon = document.createElement("div");
  icon.className = "w-9 h-9 rounded-xl bg-violet-100 flex items-center justify-center text-violet-600 font-bold text-sm flex-shrink-0";
  icon.textContent = iconChar;

  const info = document.createElement("div");

  const name = document.createElement("p");
  name.className = "font-semibold text-gray-900";
  name.textContent = displayName;

  const idEl = document.createElement("p");
  idEl.className = "text-xs text-gray-400 font-mono";
  idEl.textContent = convId.slice(0, 8);

  info.appendChild(name);
  info.appendChild(idEl);
  wrapper.appendChild(icon);
  wrapper.appendChild(info);
  header.appendChild(wrapper);
}

// ── Messages ─────────────────────────────────────────────────────────────────
function renderMessage(msg, prepend = false) {
  if (msg.id && renderedMessageIds.has(msg.id)) return;
  if (msg.id) renderedMessageIds.add(msg.id);

  const list = document.getElementById("messages-list");

  const senderId = msg.sender?.id || msg.senderId;
  const senderName =
    msg.sender?.username ||
    msg.sender?.phone ||
    senderId?.slice(0, 8) ||
    "?";

  const isMe = senderId === currentUser?.id;
  const isBlocked = msg.status === "BLOCKED";

  const wrapper = document.createElement("div");
  wrapper.className = `group flex items-end gap-2 ${
    isMe ? "justify-end" : "justify-start"
  }`;

  const bubble = document.createElement("div");
  bubble.className = [
    "px-4 py-2.5 rounded-2xl max-w-md break-words text-sm",
    isMe ? "bg-violet-600 text-white rounded-br-sm" : "bg-white border border-gray-200 shadow-sm rounded-bl-sm",
    isBlocked ? "italic opacity-50" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const content = document.createElement("p");
  content.textContent = isBlocked
    ? "🚫 Message bloqué par la modération"
    : msg.content;

  bubble.appendChild(content);

  const createdAt = msg.createdAt
    ? new Date(msg.createdAt).toLocaleTimeString()
    : "now";

  const meta = document.createElement("p");
  meta.className = `text-[10px] mt-1 ${
    isMe ? "text-violet-200" : "text-gray-400"
  }`;
  meta.textContent = `${senderName} · ${createdAt}`;

  bubble.appendChild(meta);

  const actions = document.createElement("div");
  actions.className =
    "flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity";

  const messageId = msg.id || msg._id;

  if (!isMe && !isBlocked && messageId) {
    const reportBtn = document.createElement("button");
    reportBtn.className =
      "text-xs text-orange-500 hover:text-orange-700 whitespace-nowrap";
    reportBtn.textContent = "Signaler";
    reportBtn.addEventListener("click", () => reportMessage(messageId));
    actions.appendChild(reportBtn);
  }

  const isMod =
    currentUser?.role === "MODERATOR" || currentUser?.role === "ADMIN";

  if (isMod && !isBlocked && messageId) {
    const blockBtn = document.createElement("button");
    blockBtn.className =
      "text-xs text-red-500 hover:text-red-700 whitespace-nowrap";
    blockBtn.textContent = "Bloquer";
    blockBtn.addEventListener("click", () => blockMessage(messageId));
    actions.appendChild(blockBtn);
  }

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

// ── Pagination ───────────────────────────────────────────────────────────────
document.getElementById("messages-list").addEventListener("scroll", async () => {
  const list = document.getElementById("messages-list");

  if (list.scrollTop > 10) return;
  if (!activeConversationId) return;
  if (!hasMoreByConv.get(activeConversationId)) return;
  if (isLoadingMore) return;

  const cursor = oldestByConv.get(activeConversationId);
  if (!cursor) return;

  isLoadingMore = true;

  try {
    const { status, body } = await apiCall(
      "GET",
      `/conversations/${activeConversationId}/messages?limit=50&before=${cursor}`
    );

    if (status !== 200) {
      console.error("load more messages failed", status, body);
      return;
    }

    const msgs = body.messages || [];
    const oldHeight = list.scrollHeight;

    msgs.reverse().forEach((m) => renderMessage(m, true));

    list.scrollTop = list.scrollHeight - oldHeight;

    hasMoreByConv.set(activeConversationId, body.hasMore || false);

    if (body.hasMore && body.nextCursor) {
      oldestByConv.set(activeConversationId, body.nextCursor);
    } else {
      oldestByConv.delete(activeConversationId);
    }
  } finally {
    isLoadingMore = false;
  }
});

// ── Envoi message ────────────────────────────────────────────────────────────
document.getElementById("send-form").addEventListener("submit", (e) => {
  e.preventDefault();

  const input = document.getElementById("message-input");
  const button = e.target.querySelector("button");
  const text = input.value.trim();

  if (!text || !activeConversationId || !socket) return;

  button.disabled = true;

  socket.emit("message:send", {
    conversationId: activeConversationId,
    content: text,
    clientMessageId: `cli-${Date.now()}`,
  });

  input.value = "";

  setTimeout(() => {
    button.disabled = false;
  }, 300);
});

// ── Reports / Modération ─────────────────────────────────────────────────────
async function reportMessage(messageId) {
  const reason = prompt("Pourquoi signales-tu ce message ?");

  if (!reason || reason.trim().length < 3) return;

  const { status, body } = await apiCall("POST", "/reports", {
    messageId,
    reason: reason.trim(),
  });

  if (status === 201) {
    alert("Message signalé. Merci.");
  } else if (status === 409) {
    alert("Tu as déjà signalé ce message.");
  } else if (status === 400) {
    alert("Signalement invalide.");
  } else {
    console.error("reportMessage failed", status, body);
    alert("Erreur lors du signalement.");
  }
}

async function blockMessage(messageId) {
  if (!confirm("Bloquer ce message ?")) return;

  const { status, body } = await apiCall("PATCH", `/messages/${messageId}/block`);

  if (status === 200) {
    if (activeConversationId) {
      await selectConversation(activeConversationId);
    }
  } else {
    console.error("blockMessage failed", status, body);
    alert("Erreur lors du blocage.");
  }
}

// ── Modal reports ────────────────────────────────────────────────────────────
async function openReportsModal() {
  const { status, body } = await apiCall(
    "GET",
    "/moderation/reports?status=OPEN"
  );

  if (status !== 200) {
    console.error("openReportsModal failed", status, body);
    alert("Impossible de charger les signalements.");
    return;
  }

  const reportsList = document.getElementById("reports-list");
  reportsList.innerHTML = "";

  if (body.total === 0) {
    const empty = document.createElement("p");
    empty.className = "text-gray-500 text-center py-4";
    empty.textContent = "Aucun signalement ouvert.";
    reportsList.appendChild(empty);
  } else {
    for (const report of body.reports || []) {
      const li = document.createElement("li");
      li.className = "border-b pb-3";

      const header = document.createElement("p");
      header.className = "text-sm";

      const reporter = document.createElement("strong");
      reporter.textContent = report.reporter?.username || "?";

      const sender = document.createElement("strong");
      sender.textContent = report.message?.sender?.username || "?";

      header.appendChild(reporter);
      header.append(" a signalé ");
      header.appendChild(sender);

      const reason = document.createElement("p");
      reason.className = "text-xs text-gray-500 mt-1";
      reason.textContent = `Raison : ${report.reason}`;

      const msgContent = document.createElement("p");
      msgContent.className = "bg-gray-100 p-2 rounded text-sm mt-1";
      msgContent.textContent = `"${report.message?.content || "—"}"`;

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

document
  .getElementById("close-reports-btn")
  .addEventListener("click", () => hideElement("reports-modal"));

// ── Nouveau DM ───────────────────────────────────────────────────────────────
document.getElementById("new-dm-btn").addEventListener("click", async () => {
  const otherUserId = prompt("ID de l'utilisateur ?");

  if (!otherUserId || !otherUserId.trim()) return;

  const { status, body } = await apiCall("POST", "/conversations/dm", {
    otherUserId: otherUserId.trim(),
  });

  if (![200, 201].includes(status)) {
    console.error("create DM failed", status, body);
    alert("Erreur lors de la création du DM.");
    return;
  }

  await loadConversations();

  const convId =
    body.conversation?.id ||
    body.conversation?._id ||
    body.id ||
    body._id;

  if (convId) {
    await selectConversation(convId);
  }
});

// ── Login téléphone ──────────────────────────────────────────────────────────
document.getElementById("phone-form").addEventListener("submit", async (e) => {
  e.preventDefault();

  const phone = document.getElementById("phone-input").value.trim();

  const { status, body } = await apiCall(
    "POST",
    "/auth/request-otp",
    { phone },
    false
  );

  if (status === 200) {
    currentPhone = phone;
    hideElement("phone-form");
    showElement("otp-form");
    hideElement("login-error");
  } else {
    console.error("request otp failed", status, body);
    showError("Numéro invalide");
  }
});

// ── Login OTP ────────────────────────────────────────────────────────────────
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
    await enterApp(body.user);
  } else if (status === 401) {
    showError("Code incorrect (essaie 123456)");
  } else {
    console.error("verify otp failed", status, body);
    showError("Erreur, réessaie");
  }
});

// ── Logout ──────────────────────────────────────────────────────────────────
document.getElementById("logout-btn").addEventListener("click", () => {
  if (socket) socket.disconnect();

  clearToken();
  currentUser = null;
  activeConversationId = null;
  joinedConvs.clear();
  oldestByConv.clear();
  hasMoreByConv.clear();
  renderedMessageIds.clear();

  location.reload();
});

// ── Point d'entrée ───────────────────────────────────────────────────────────
initHomeButtons();
bootstrap();
