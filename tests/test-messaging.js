// SafeChat — End-to-end test for Étape 6 (Messagerie temps réel)
// Run: node test-messaging.js
// Requires: socket.io-client (npm install socket.io-client)
// Node 18+ for built-in fetch.

const { io } = require("socket.io-client");

const BASE = "http://localhost:3001";

// ---------- Helpers ----------
function log(msg, ok = true) {
  const tag = ok ? "✅" : "❌";
  console.log(`${tag} ${msg}`);
}
function header(t) {
  console.log("\n=== " + t + " ===");
}
async function fetchJson(url, opts = {}) {
  const r = await fetch(url, opts);
  let body = null;
  try { body = await r.json(); } catch {}
  return { status: r.status, body };
}
async function authenticate(phone) {
  await fetchJson(`${BASE}/auth/request-otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone }),
  });
  const r = await fetchJson(`${BASE}/auth/verify-otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone, otp: "123456" }),
  });
  if (r.status !== 200) throw new Error("AUTH_FAILED for " + phone);
  return { token: r.body.token, id: r.body.user.id, phone };
}
function connectSocket(token) {
  return new Promise((resolve, reject) => {
    const socket = io(BASE, { auth: { token }, reconnection: false });
    socket.on("connect", () => resolve(socket));
    socket.on("connect_error", (err) => {
      socket.disconnect();
      reject(err);
    });
    setTimeout(() => {
      socket.disconnect();
      reject(new Error("CONNECT_TIMEOUT"));
    }, 5000);
  });
}
function waitEvent(socket, event, timeout = 3000) {
  return new Promise((resolve, reject) => {
    const handler = (payload) => { clearTimeout(t); resolve(payload); };
    const t = setTimeout(() => {
      socket.off(event, handler);
      reject(new Error("EVENT_TIMEOUT: " + event));
    }, timeout);
    socket.once(event, handler);
  });
}

// ---------- Main ----------
(async () => {
  header("Setup : auth UserA et UserB");

  const suffix = Date.now().toString().slice(-8);

  const A = await authenticate(`06${suffix}`);
  const B = await authenticate(`07${suffix}`);
  const C = await authenticate(`08${suffix}`);
  
  console.log("UserA =", A.id);
  console.log("UserB =", B.id);
  console.log("UserC =", C.id);

  header("6.2.1 Connexion socket sans token (doit échouer)");
  try {
    await connectSocket(null);
    log("Connexion sans token — PAS attendu", false);
  } catch (e) {
    log(`Refus attendu : ${e.message}`);
  }
  await new Promise(r => setTimeout(r, 200));

  header("6.2.2 Connexion socket avec token bidon (doit échouer)");
  try {
    await connectSocket("not.a.real.token");
    log("Connexion avec token bidon — PAS attendu", false);
  } catch (e) {
    log(`Refus attendu : ${e.message}`);
  }
  await new Promise(r => setTimeout(r, 200));

  header("6.2.3 Connexion socket avec vrais tokens");
  const sockA = await connectSocket(A.token);
  const sockB = await connectSocket(B.token);
  log(`UserA connecté : ${sockA.id}`);
  log(`UserB connecté : ${sockB.id}`);

  // =========================================================================

  header("Prep : créer un DM A↔B et joindre via socket");
  const dm = await fetchJson(`${BASE}/conversations/dm`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${A.token}` },
    body: JSON.stringify({ otherUserId: B.id }),
  });

  if (![200, 201].includes(dm.status)) {
    throw new Error(`DM_CREATE_FAILED: status ${dm.status} ${JSON.stringify(dm.body)}`);
  }

  const convId = dm.body.conversation?.id || dm.body.conversation?._id || dm.body.id || dm.body._id;

  if (!convId) {
    throw new Error(`CONVERSATION_ID_NOT_FOUND: ${JSON.stringify(dm.body)}`);
  }
  console.log("DM convId =", convId);

  console.log("[DEBUG] sockA emits conversation:join");
  sockA.emit("conversation:join", { conversationId: convId });
  await waitEvent(sockA, "conversation:joined");
  console.log("[DEBUG] sockB emits conversation:join");
  sockB.emit("conversation:join", { conversationId: convId });
  await waitEvent(sockB, "conversation:joined");
  log("Les 2 sockets ont rejoint la conversation");

  header("6.x.1 Envoi message A → réception B en temps réel");
  const recvPromise = waitEvent(sockB, "message:new");
  sockA.emit("message:send", {
    conversationId: convId,
    content: "Salut B, premier message !",
    clientMessageId: "cli-1",
  });
  const received = await recvPromise;
  if (received.content === "Salut B, premier message !") {
    log(`Reçu côté B : "${received.content}" (id=${received.id})`);
  } else {
    log("Contenu reçu incorrect", false);
  }

  header("6.x.2 Ack reçu par l'émetteur");
  const ack = await waitEvent(sockA, "message:ack", 1000).catch(() => null);
  if (ack && ack.clientMessageId === "cli-1") log(`Ack reçu : ${ack.messageId}`);
  else log("Ack non reçu (acceptable si tu n'as pas implémenté l'event)", false);

  header("6.x.3 Envoyer 4 messages de plus pour tester l'historique");
  for (let i = 2; i <= 5; i++) {
    sockA.emit("message:send", {
      conversationId: convId,
      content: `Message ${i}`,
      clientMessageId: `cli-${i}`,
    });
    await new Promise((r) => setTimeout(r, 80));
  }
  await new Promise((r) => setTimeout(r, 300));
  log("5 messages envoyés au total");

  header("6.3.1 GET historique sans token (doit 401)");
  const noAuth = await fetchJson(`${BASE}/conversations/${convId}/messages`);
  log(`Status ${noAuth.status} (attendu 401)`, noAuth.status === 401);

  header("6.3.2 GET historique avec UserC (non membre, doit 403)");
  const notMember = await fetchJson(`${BASE}/conversations/${convId}/messages`, {
    headers: { Authorization: `Bearer ${C.token}` },
  });
  log(`Status ${notMember.status} (attendu 403)`, notMember.status === 403);

  header("6.3.3 GET historique avec UserA (membre)");
  const all = await fetchJson(`${BASE}/conversations/${convId}/messages`, {
    headers: { Authorization: `Bearer ${A.token}` },
  });
  log(`Status ${all.status}, ${all.body.messages.length} messages, hasMore=${all.body.hasMore}`);

  header("6.3.4 GET historique paginé : limit=2");
  const page1 = await fetchJson(`${BASE}/conversations/${convId}/messages?limit=2`, {
    headers: { Authorization: `Bearer ${A.token}` },
  });
  log(`Page 1 : ${page1.body.messages.length} msgs, hasMore=${page1.body.hasMore}, nextCursor=${page1.body.nextCursor?.slice(0, 8)}...`);

  header("6.3.5 GET page 2 avec before=nextCursor");
  const page2 = await fetchJson(
    `${BASE}/conversations/${convId}/messages?limit=2&before=${page1.body.nextCursor}`,
    { headers: { Authorization: `Bearer ${A.token}` } }
  );
  log(`Page 2 : ${page2.body.messages.length} msgs, hasMore=${page2.body.hasMore}`);

  header("6.3.6 GET avec :id bidon (doit 400)");
  const badId = await fetchJson(`${BASE}/conversations/pas-un-id/messages`, {
    headers: { Authorization: `Bearer ${A.token}` },
  });
  log(`Status ${badId.status} (attendu 400)`, badId.status === 400);

  header("6.3.7 GET avec :id inexistant (doit 404)");
  const noConv = await fetchJson(`${BASE}/conversations/000000000000000000000000/messages`, {
    headers: { Authorization: `Bearer ${A.token}` },
  });
  log(`Status ${noConv.status} (attendu 404)`, noConv.status === 404);

  header("Nettoyage : fermeture des sockets");
  sockA.disconnect();
  sockB.disconnect();
  log("Sockets fermés");

  console.log("\n=== Tests Étape 6 (Messagerie temps réel) terminés ===");
  process.exit(0);
})().catch((e) => {
  console.error("\n❌ Test failed:", e);
  process.exit(1);
});
