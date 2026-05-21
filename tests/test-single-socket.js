// tests/test-single-socket.js
const { io } = require("socket.io-client");

const BASE = "http://localhost:3001";
const phone = `06${Date.now().toString().slice(-8)}`;

(async () => {
  await fetch(`${BASE}/auth/request-otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone })
  });

  const r = await fetch(`${BASE}/auth/verify-otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone, otp: "123456" })
  }).then(r => r.json());

  console.log("Token obtenu :", r.token.slice(0, 30) + "...");

  const socket = io(BASE, {
    auth: { token: r.token },
    reconnection: false
  });

  socket.on("connect", () => {
    console.log("✅ Connecté :", socket.id);
    socket.disconnect();
    process.exit(0);
  });

  socket.on("connect_error", (err) => {
    console.log("❌ Erreur :", err.message, err.description || "");
    process.exit(1);
  });

  setTimeout(() => {
    console.log("⏱️ Timeout (5s)");
    process.exit(1);
  }, 5000);
})();
