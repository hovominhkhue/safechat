// SafeChat — End-to-end test for Étape 7 (Signalement et modération)
// Run: node test-reports.js
// Requires: socket.io-client (déjà installé pour test-messaging.js)
// Node 18+ for built-in fetch.

const { io } = require("socket.io-client");
const { execSync } = require("child_process");

const BASE = "http://localhost:3001";

// ---------- Helpers ----------
function log(msg, ok = true) {
  console.log(`${ok ? "✅" : "❌"} ${msg}`);
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
  return { token: r.body.token, id: r.body.user.id, phone, role: r.body.user.role };
}
function connectSocket(token) {
  return new Promise((resolve, reject) => {
    const socket = io(BASE, { auth: { token }, reconnection: false });
    socket.on("connect", () => resolve(socket));
    socket.on("connect_error", (err) => { socket.disconnect(); reject(err); });
    setTimeout(() => { socket.disconnect(); reject(new Error("CONNECT_TIMEOUT")); }, 5000);
  });
}
function waitEvent(socket, event, timeout = 3000) {
  return new Promise((resolve, reject) => {
    const handler = (p) => { clearTimeout(t); resolve(p); };
    const t = setTimeout(() => { socket.off(event, handler); reject(new Error("EVENT_TIMEOUT: " + event)); }, timeout);
    socket.once(event, handler);
  });
}
function promoteUserRole(phone, role) {
  const script = `db.users.updateOne({phone: '${phone}'}, {$set: {role: '${role}'}})`;
  execSync(`docker exec safechat-mongo mongosh safechat --quiet --eval "${script}"`, { stdio: "pipe" });
}
function getReportStatusFromDb(messageId) {
  const out = execSync(
    `docker exec safechat-mongo mongosh safechat --quiet --eval "db.reports.findOne({messageId: ObjectId('${messageId}')})"`,
    { encoding: "utf8" }
  );
  return out;
}

// ---------- Main ----------
(async () => {
  header("Setup : 3 users, promotion A en MODERATOR, DM + message");

  // 1. Auth les 3 users
  let A = await authenticate("0611111111");
  const B = await authenticate("0622222222");
  const C = await authenticate("0633333333");
  console.log("UserA =", A.id, "(role JWT initial:", A.role + ")");
  console.log("UserB =", B.id);
  console.log("UserC =", C.id);

  // 2. Promouvoir UserA en MODERATOR
  promoteUserRole("0611111111", "MODERATOR");
  log("UserA promu MODERATOR en base");

  await new Promise(r => setTimeout(r, 500));

  // 3. UserA se réauthentifie pour avoir un JWT avec role=MODERATOR
  A = await authenticate("0611111111");
  console.log("UserA role après re-auth:", A.role);
  if (A.role !== "MODERATOR") {
    console.error("❌ Le JWT ne reflète pas le nouveau rôle. Abandon.");
    process.exit(1);
  }

  const headersA = { Authorization: `Bearer ${A.token}` };
  const headersB = { Authorization: `Bearer ${B.token}` };
  const headersC = { Authorization: `Bearer ${C.token}` };

  // 4. Créer un DM B↔C
  const dm = await fetchJson(`${BASE}/conversations/dm`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headersB },
    body: JSON.stringify({ otherUserId: C.id }),
  });
  const convId = dm.body.conversation.id;
  console.log("DM B↔C convId =", convId);

  // 5. UserC envoie un message via socket dans le DM
  const sockC = await connectSocket(C.token);
  sockC.emit("conversation:join", { conversationId: convId });
  await waitEvent(sockC, "conversation:joined");
  const recvAck = waitEvent(sockC, "message:ack", 3000);
  sockC.emit("message:send", {
    conversationId: convId,
    content: "Message inapproprié pour test signalement",
    clientMessageId: "cli-evil-1",
  });
  const ack = await recvAck;
  const messageId = ack.messageId;
  sockC.disconnect();
  console.log("Message C envoyé, msgId =", messageId);

  // ============================================================
  // 7.1 — POST /reports
  // ============================================================
  header("7.1.1 POST /reports sans token (doit 401)");
  let r = await fetchJson(`${BASE}/reports`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messageId, reason: "spam" }),
  });
  log(`Status ${r.status} (attendu 401)`, r.status === 401);

  header("7.1.2 UserB signale le message de UserC (doit 201)");
  r = await fetchJson(`${BASE}/reports`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headersB },
    body: JSON.stringify({ messageId, reason: "Contenu inapproprié" }),
  });
  log(`Status ${r.status} (attendu 201), report.status=${r.body?.report?.status}`, r.status === 201);

  header("7.1.3 UserB tente de signaler à nouveau (doit 409 ALREADY_REPORTED)");
  r = await fetchJson(`${BASE}/reports`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headersB },
    body: JSON.stringify({ messageId, reason: "Encore" }),
  });
  log(`Status ${r.status} (attendu 409), error=${r.body?.error}`, r.status === 409);

  header("7.1.4 UserC tente de signaler son propre message (doit 400 CANNOT_REPORT_OWN_MESSAGE)");
  r = await fetchJson(`${BASE}/reports`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headersC },
    body: JSON.stringify({ messageId, reason: "Auto-signalement" }),
  });
  log(`Status ${r.status} (attendu 400), error=${r.body?.error}`, r.status === 400);

  header("7.1.5 Signalement avec messageId inexistant (doit 404)");
  r = await fetchJson(`${BASE}/reports`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headersB },
    body: JSON.stringify({ messageId: "000000000000000000000000", reason: "Ghost" }),
  });
  log(`Status ${r.status} (attendu 404), error=${r.body?.error}`, r.status === 404);

  header("7.1.6 Signalement sans reason (doit 400)");
  r = await fetchJson(`${BASE}/reports`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headersB },
    body: JSON.stringify({ messageId }),
  });
  log(`Status ${r.status} (attendu 400)`, r.status === 400);

  // ============================================================
  // 7.2 — GET /moderation/reports
  // ============================================================
  header("7.2.1 GET /moderation/reports sans token (doit 401)");
  r = await fetchJson(`${BASE}/moderation/reports`);
  log(`Status ${r.status} (attendu 401)`, r.status === 401);

  header("7.2.2 UserB (USER) liste les reports (doit 403)");
  r = await fetchJson(`${BASE}/moderation/reports`, { headers: headersB });
  log(`Status ${r.status} (attendu 403)`, r.status === 403);

  header("7.2.3 UserA (MODERATOR) liste les reports OPEN");
  r = await fetchJson(`${BASE}/moderation/reports`, { headers: headersA });
  log(`Status ${r.status}, total=${r.body?.total} (attendu 1)`, r.status === 200 && r.body.total === 1);
  if (r.body?.reports?.[0]) {
    console.log("   Premier report :", JSON.stringify({
      id: r.body.reports[0].id,
      status: r.body.reports[0].status,
      reason: r.body.reports[0].reason,
      reporter: r.body.reports[0].reporter?.username,
      messageSender: r.body.reports[0].message?.sender?.username,
      messageContent: r.body.reports[0].message?.content?.slice(0, 40) + "..."
    }));
  }

  header("7.2.4 UserA filtre par status=RESOLVED (doit être vide)");
  r = await fetchJson(`${BASE}/moderation/reports?status=RESOLVED`, { headers: headersA });
  log(`Status ${r.status}, total=${r.body?.total} (attendu 0)`, r.status === 200 && r.body.total === 0);

  header("7.2.5 UserA filtre avec status invalide (doit 400)");
  r = await fetchJson(`${BASE}/moderation/reports?status=BIDON`, { headers: headersA });
  log(`Status ${r.status} (attendu 400), error=${r.body?.error}`, r.status === 400);

  // ============================================================
  // 7.3 — PATCH /messages/:id/block
  // ============================================================
  header("7.3.1 PATCH /messages/:id/block sans token (doit 401)");
  r = await fetchJson(`${BASE}/messages/${messageId}/block`, { method: "PATCH" });
  log(`Status ${r.status} (attendu 401)`, r.status === 401);

  header("7.3.2 UserB (USER) tente de bloquer (doit 403)");
  r = await fetchJson(`${BASE}/messages/${messageId}/block`, { method: "PATCH", headers: headersB });
  log(`Status ${r.status} (attendu 403)`, r.status === 403);

  header("7.3.3 UserC (USER, auteur du message) tente de bloquer (doit 403)");
  r = await fetchJson(`${BASE}/messages/${messageId}/block`, { method: "PATCH", headers: headersC });
  log(`Status ${r.status} (attendu 403)`, r.status === 403);

  header("7.3.4 UserA (MODERATOR) bloque le message (doit 200 + resolvedReportsCount=1)");
  r = await fetchJson(`${BASE}/messages/${messageId}/block`, { method: "PATCH", headers: headersA });
  log(`Status ${r.status}, status=${r.body?.message?.status}, resolved=${r.body?.resolvedReportsCount}`,
      r.status === 200 && r.body.message.status === "BLOCKED" && r.body.resolvedReportsCount === 1);

  header("7.3.5 UserA bloque à nouveau (idempotent, doit 200 sans erreur)");
  r = await fetchJson(`${BASE}/messages/${messageId}/block`, { method: "PATCH", headers: headersA });
  log(`Status ${r.status}, status=${r.body?.message?.status}`, r.status === 200 && r.body.message.status === "BLOCKED");

  header("7.3.6 PATCH avec :id bidon (doit 400)");
  r = await fetchJson(`${BASE}/messages/pas-un-id/block`, { method: "PATCH", headers: headersA });
  log(`Status ${r.status} (attendu 400)`, r.status === 400);

  header("7.3.7 PATCH avec :id inexistant (doit 404)");
  r = await fetchJson(`${BASE}/messages/000000000000000000000000/block`, { method: "PATCH", headers: headersA });
  log(`Status ${r.status} (attendu 404)`, r.status === 404);

  // ============================================================
  // Cohérence post-block : le report doit avoir basculé en RESOLVED
  // ============================================================
  header("Cohérence : le report doit être RESOLVED avec handledBy=UserA");
  r = await fetchJson(`${BASE}/moderation/reports?status=OPEN`, { headers: headersA });
  log(`reports OPEN après block : ${r.body?.total} (attendu 0)`, r.body.total === 0);

  r = await fetchJson(`${BASE}/moderation/reports?status=RESOLVED`, { headers: headersA });
  const resolved = r.body?.reports?.[0];
  if (resolved) {
    const handledByUserA = resolved.handledBy?.id === A.id;
    log(`reports RESOLVED : ${r.body.total}, handledBy=${resolved.handledBy?.username}`, r.body.total === 1 && handledByUserA);
  } else {
    log("Aucun report RESOLVED trouvé", false);
  }

  console.log("\n=== Tests Étape 7 (Signalement et modération) terminés ===");
  process.exit(0);
})().catch((e) => {
  console.error("\n❌ Test failed:", e);
  process.exit(1);
});
