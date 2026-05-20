// Test 6.2 — JWT socket auth
// Setup : npm init -y && npm install socket.io-client dotenv
// Run   : node test-auth.js
require("dotenv").config({ path: "../backend/.env" });

const { io } = require("socket.io-client");

const BASE_URL = "http://localhost:3001";
const PHONE    = "+33611111111";
const OTP      = process.env.OTP_FAKE_CODE;

if (!OTP) {
  console.error("OTP_FAKE_CODE manquant — vérifie backend/.env");
  process.exit(1);
}

// ── helpers ─────────────────────────────────────────────────────────────────

async function post(path, body) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: res.status, data: await res.json() };
}

function connectSocket(opts) {
  return new Promise((resolve, reject) => {
    const socket = io(BASE_URL, { ...opts, reconnection: false });
    socket.once("connect",       () => resolve({ ok: true, socket }));
    socket.once("connect_error", (err) => { socket.disconnect(); resolve({ ok: false, error: err.message }); });
    setTimeout(() => { socket.disconnect(); reject(new Error("timeout")); }, 4000);
  });
}

// ── main ─────────────────────────────────────────────────────────────────────

(async () => {
  console.log("═══════════════════════════════════════");
  console.log(" SafeChat 6.2 — JWT socket auth test");
  console.log("═══════════════════════════════════════\n");

  // 1. Obtenir un vrai token
  console.log("1) Récupération du token pour", PHONE);
  await post("/auth/send-otp", { phone: PHONE });
  const { status: s, data: d } = await post("/auth/verify-otp", { phone: PHONE, otp: OTP });
  if (s !== 200 || !d.token) {
    console.error("   ✗ verify-otp échoué:", s, d);
    process.exit(1);
  }
  const token = d.token;
  console.log("   ✓ token obtenu pour user", d.user.id, "\n");

  // 2. Connexion SANS token → NO_TOKEN
  console.log("2) Connexion sans token → attend NO_TOKEN");
  const r2 = await connectSocket({});
  const pass2 = !r2.ok && r2.error === "NO_TOKEN";
  console.log(pass2 ? "   ✓ NO_TOKEN reçu" : `   ✗ Attendu NO_TOKEN, reçu: ${r2.error}\n`);

  // 3. Connexion avec token bidon → INVALID_TOKEN
  console.log("\n3) Connexion avec token bidon → attend INVALID_TOKEN");
  const r3 = await connectSocket({ auth: { token: "not.a.valid.jwt" } });
  const pass3 = !r3.ok && r3.error === "INVALID_TOKEN";
  console.log(pass3 ? "   ✓ INVALID_TOKEN reçu" : `   ✗ Attendu INVALID_TOKEN, reçu: ${r3.error}`);

  // 4. Connexion avec le vrai token → connect
  console.log("\n4) Connexion avec le vrai token → attend connect");
  const r4 = await connectSocket({ auth: { token } });
  if (!r4.ok) {
    console.error("   ✗ connect_error:", r4.error);
    process.exit(1);
  }
  console.log("   ✓ connecté, socket.id:", r4.socket.id);
  console.log("   (vérifier dans les logs backend : [socket] connected <id> — user", d.user.id, ")\n");

  // 5. Déconnexion propre
  r4.socket.disconnect();
  console.log("5) Déconnexion propre ✓");

  console.log("\n═══════════════════════════════════════");
  const allPass = pass2 && pass3 && r4.ok;
  console.log(allPass ? " Tous les tests passent ✓" : " Certains tests ont échoué ✗");
  console.log("═══════════════════════════════════════");
  process.exit(allPass ? 0 : 1);
})();
