const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");

// Ordre de lecture du token :
// 1. socket.handshake.auth.token       (recommandé)
// 2. Authorization: Bearer <token>     (header HTTP upgrade)
// 3. socket.handshake.query.token      (fallback dev)
module.exports = function jwtAuthMiddleware(socket, next) {
  const authHeader = socket.handshake.headers?.authorization;
  const token =
    socket.handshake.auth?.token ||
    (authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null) ||
    socket.handshake.query?.token ||
    null;

  if (!token) return next(new Error("NO_TOKEN"));

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    socket.data.userId = new mongoose.Types.ObjectId(payload.userId);
    socket.data.role = payload.role;
    return next();
  } catch {
    return next(new Error("INVALID_TOKEN"));
  }
};
