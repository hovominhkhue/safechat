const mongoose = require("mongoose");
const ConversationMember = require("../models/ConversationMember");
const Conversation = require("../models/Conversation");
const User = require("../models/User");

async function listMine(req, res) {
  try {
    const userId = new mongoose.Types.ObjectId(req.user.userId);

    const memberships = await ConversationMember.find({ userId }).lean();

    if (memberships.length === 0) {
      return res.status(200).json({ conversations: [] });
    }

    const roleByConvId = {};
    for (const m of memberships) {
      roleByConvId[m.conversationId.toString()] = m.role;
    }

    const convIds = memberships.map((m) => m.conversationId);

    const convs = await Conversation.find({ _id: { $in: convIds } })
      .sort({ lastMessageAt: -1, createdAt: -1 })
      .lean();

    const conversations = convs.map((c) => ({
      id: c._id.toString(),
      type: c.type,
      name: c.title || null,
      channelTopic: c.channelTopic || null,
      lastMessageAt: c.lastMessageAt || null,
      lastMessagePreview: c.lastMessagePreview || null,
      messageCount: c.messageCount,
      myRole: roleByConvId[c._id.toString()],
    }));

    return res.status(200).json({ conversations });
  } catch (e) {
    console.error("LIST_CONVERSATIONS_FAILED:", e);
    return res.status(500).json({ error: "LIST_CONVERSATIONS_FAILED", message: e.message });
  }
}

async function createOrGetDm(req, res) {
  try {
    const { otherUserId } = req.body;

    if (!otherUserId || !mongoose.isValidObjectId(otherUserId)) {
      return res.status(400).json({ error: "BAD_REQUEST", message: "otherUserId est requis et doit être un ObjectId valide" });
    }

    const userAId = new mongoose.Types.ObjectId(req.user.userId);
    const userBId = new mongoose.Types.ObjectId(otherUserId);

    if (userAId.equals(userBId)) {
      return res.status(400).json({ error: "SELF_DM" });
    }

    const otherUser = await User.findById(userBId).lean();
    if (!otherUser) {
      return res.status(404).json({ error: "USER_NOT_FOUND" });
    }

    const [a, b] = [String(userAId), String(userBId)].sort();
    const dmKey = `${a}_${b}`;

    const existing = await Conversation.findOne({ type: "DM", dmKey }).lean();

    if (existing) {
      return res.status(200).json({
        conversation: {
          id: existing._id.toString(),
          type: existing.type,
          dmKey: existing.dmKey,
          otherUser: { id: otherUser._id.toString(), username: otherUser.username },
          myRole: "MEMBER",
        },
      });
    }

    const conv = await Conversation.create({
      type: "DM",
      channelId: dmKey,
      dmKey,
      createdBy: userAId,
    });

    await ConversationMember.insertMany([
      { conversationId: conv._id, userId: userAId, role: "MEMBER" },
      { conversationId: conv._id, userId: userBId, role: "MEMBER" },
    ]);

    return res.status(201).json({
      conversation: {
        id: conv._id.toString(),
        type: conv.type,
        dmKey: conv.dmKey,
        otherUser: { id: otherUser._id.toString(), username: otherUser.username },
        myRole: "MEMBER",
      },
    });
  } catch (e) {
    console.error("CREATE_OR_GET_DM_FAILED:", e);
    return res.status(500).json({ error: "CREATE_OR_GET_DM_FAILED", message: e.message });
  }
}

module.exports = { listMine, createOrGetDm };
