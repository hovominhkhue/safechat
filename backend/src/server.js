require("dotenv").config();
const http = require("http");
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const { Server } = require("socket.io");

const connectDB = require("./config/db");

// Models (ObjectId)
const User = require("./models/User");
const Conversation = require("./models/Conversation");
const ConversationMember = require("./models/ConversationMember");
const Message = require("./models/Message");

const app = express();
app.use(cors());
app.use(express.json());

/** Health */
app.get("/health", (req, res) => res.json({ ok: true }));

/**
 * DEV ONLY — Create user manually
 * POST /dev/users
 * body: { username, role? }
 */
app.post("/dev/users", async (req, res) => {
  try {
    const { username, role } = req.body;
    if (!username) return res.status(400).json({ error: "username required" });

    const user = await User.create({ username, role: role || "USER" });
    res.json({ user });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "CREATE_USER_FAILED" });
  }
});

/**
 * DEV ONLY — Create GROUP conversation + members
 * POST /dev/conversations/group
 * body: { channelId, title, ownerId, memberIds?: [] }
 */
app.post("/dev/conversations/group", async (req, res) => {
  try {
    const { channelId, title, ownerId, memberIds = [] } = req.body;

    if (!channelId || !title || !ownerId) {
      return res.status(400).json({ error: "channelId, title, ownerId required" });
    }

    if (!mongoose.isValidObjectId(ownerId)) {
      return res.status(400).json({ error: "INVALID_OWNER_ID" });
    }

    for (const id of memberIds) {
      if (!mongoose.isValidObjectId(id)) {
        return res.status(400).json({ error: `INVALID_MEMBER_ID: ${id}` });
      }
    }

    const conv = await Conversation.create({
      type: "GROUP",
      channelId,
      title,
      createdBy: new mongoose.Types.ObjectId(ownerId),
    });

    const members = [
      {
        conversationId: conv._id,
        userId: new mongoose.Types.ObjectId(ownerId),
        role: "OWNER",
      },
      ...memberIds.map((id) => ({
        conversationId: conv._id,
        userId: new mongoose.Types.ObjectId(id),
        role: "MEMBER",
      })),
    ];

    await ConversationMember.insertMany(members);

    res.json({ conversation: conv });
  } catch (e) {
    console.error("CREATE_GROUP_FAILED:", e);
    res.status(500).json({
      error: "CREATE_GROUP_FAILED",
      details: e.message,
    });
  }
});

/**
 * DEV ONLY — Create or get DM conversation + members
 * POST /dev/conversations/dm
 * body: { channelId, userAId, userBId }
 */
app.post("/dev/conversations/dm", async (req, res) => {
  try {
    const { channelId, userAId, userBId } = req.body;
    if (!channelId || !userAId || !userBId) {
      return res.status(400).json({ error: "channelId, userAId, userBId required" });
    }

    const [a, b] = [String(userAId), String(userBId)].sort();
    const dmKey = `${a}_${b}`;

    let conv = await Conversation.findOne({ type: "DM", dmKey });
    if (!conv) {
      conv = await Conversation.create({
        type: "DM",
        channelId,
        dmKey,
        createdBy: userAId,
      });

      await ConversationMember.insertMany([
        { conversationId: conv._id, userId: new mongoose.Types.ObjectId(userAId), role: "MEMBER" },
        { conversationId: conv._id, userId: new mongoose.Types.ObjectId(userBId), role: "MEMBER" },
      ]);
    }

    res.json({ conversation: conv });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "CREATE_DM_FAILED" });
  }
});

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
