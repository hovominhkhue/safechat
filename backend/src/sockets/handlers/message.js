const mongoose = require("mongoose");
const ConversationMember = require("../../models/ConversationMember");
const Conversation = require("../../models/Conversation");
const Message = require("../../models/Message");

module.exports = function registerMessageHandlers(socket, io) {
  socket.on("message:send", async ({ conversationId, content, clientMessageId }) => {
    try {
      console.log(`[socket] message:send by ${socket.data.userId} in ${conversationId}`);

      if (!conversationId || !mongoose.isValidObjectId(conversationId) || !content) return;

      const convObjId = new mongoose.Types.ObjectId(conversationId);

      const member = await ConversationMember.findOne({
        conversationId: convObjId,
        userId: socket.data.userId,
      }).lean();

      if (!member) {
        socket.emit("message:error", { clientMessageId, error: "NOT_A_MEMBER" });
        return;
      }

      const msg = await Message.create({
        conversationId: convObjId,
        senderId: socket.data.userId,
        content,
        contentType: "TEXT",
      });

      const preview = content.length > 80 ? content.slice(0, 80) : content;

      await Conversation.updateOne(
        { _id: convObjId },
        {
          $set: {
            lastMessageAt: msg.createdAt,
            lastMessagePreview: preview,
            lastMessageSenderId: socket.data.userId.toString(),
          },
          $inc: { messageCount: 1 },
        }
      );

      io.to(`conversation:${conversationId}`).emit("message:new", {
        id: msg._id.toString(),
        conversationId,
        senderId: msg.senderId.toString(),
        content: msg.content,
        createdAt: msg.createdAt,
      });

      socket.emit("message:ack", {
        clientMessageId,
        messageId: msg._id.toString(),
      });
    } catch (err) {
      console.error("[socket] message:send error:", err);
      socket.emit("message:error", { clientMessageId, error: "FAILED_TO_SEND" });
    }
  });
};
