const mongoose = require("mongoose");
const ConversationMember = require("../../models/ConversationMember");

module.exports = function registerConversationHandlers(socket) {
  socket.on("conversation:join", async ({ conversationId }) => {
    try {
      console.log(`[socket] conversation:join by ${socket.data.userId} for ${conversationId}`);

      if (!conversationId || !mongoose.isValidObjectId(conversationId)) return;

      const member = await ConversationMember.findOne({
        conversationId: new mongoose.Types.ObjectId(conversationId),
        userId: socket.data.userId,
      }).lean();

      if (!member) {
        socket.emit("conversation:error", { error: "NOT_A_MEMBER" });
        return;
      }

      socket.join(`conversation:${conversationId}`);
      socket.emit("conversation:joined", { conversationId });
    } catch (err) {
      console.error("[socket] conversation:join error:", err);
      socket.emit("conversation:error", { error: "JOIN_FAILED" });
    }
  });
};
