// tests/test-single-socket.js
const { io } = require("socket.io-client");

(async () => {
  // Récupère un token
  await fetch("http://localhost:3001/auth/request-otp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone: "0611111111" })
  });
  const r = await fetch("http://localhost:3001/auth/verify-otp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone: "0611111111", otp: "123456" })
  }).then(r => r.json());

  console.log("Token obtenu :", r.token.slice(0, 30) + "...");

  // UNE seule connexion avec le vrai token
  const socket = io("http://localhost:3001", {
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
