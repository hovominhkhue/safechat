const fakeAuth = require("./middleware/auth");
const registerConversationHandlers = require("./handlers/conversation");
const registerMessageHandlers = require("./handlers/message");

module.exports = function setupSockets(io) {
  io.use(fakeAuth);

  io.on("connection", (socket) => {
    console.log(`[socket] connected ${socket.id} — user ${socket.data.userId}`);

    registerConversationHandlers(socket);
    registerMessageHandlers(socket, io);
  });
};
