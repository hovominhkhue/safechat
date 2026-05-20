const mongoose = require("mongoose");

// Fake auth : le client passe userId en query string.
// Sera remplacé par du JWT en 6.2.
module.exports = function fakeAuthMiddleware(socket, next) {
  const { userId } = socket.handshake.query || {};
  if (!userId) return next(new Error("Missing userId (fake auth)"));
  if (!mongoose.isValidObjectId(userId)) return next(new Error("Invalid userId"));
  socket.data.userId = new mongoose.Types.ObjectId(userId);
  return next();
};
