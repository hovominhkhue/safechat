require("dotenv").config();
const http = require("http");
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const { Server } = require("socket.io");

const connectDB = require("./config/db");

const Conversation = require("./models/Conversation");
const ConversationMember = require("./models/ConversationMember");
const Message = require("./models/Message");

const app = express();
app.use(cors());
app.use(express.json());

app.use("/auth", require("./routes/auth"));
app.use("/conversations", require("./routes/conversations"));
app.use("/channels", require("./routes/channels"));

/** Health */
app.get("/health", (req, res) => res.json({ ok: true }));

/** HTTP + Socket.IO */
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

/**
 * Fake auth socket (temporaire)
 * Client doit fournir userId (ObjectId string):
 * io("http://localhost:3001", { query: { userId: "..." } })
 */
io.use((socket, next) => {
  const { userId } = socket.handshake.query || {};
  if (!userId) return next(new Error("Missing userId (fake auth)"));
  if (!mongoose.isValidObjectId(userId)) return next(new Error("Invalid userId"));
  socket.data.userId = new mongoose.Types.ObjectId(userId);
  return next();
});

io.on("connection", (socket) => {
  console.log("🔌 socket connected:", socket.id, "user:", socket.data.userId.toString());

  socket.on("conversation:join", async ({ conversationId }) => {
    try {
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
      console.error(err);
      socket.emit("conversation:error", { error: "JOIN_FAILED" });
    }
  });

  socket.on("message:send", async ({ conversationId, content, clientMessageId }) => {
    try {
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
      console.error(err);
      socket.emit("message:error", { clientMessageId, error: "FAILED_TO_SEND" });
    }
  });
});

/** Start */
const PORT = process.env.PORT || 3001;

connectDB();
server.listen(PORT, () => console.log(`✅ Server on http://localhost:${PORT}`));
