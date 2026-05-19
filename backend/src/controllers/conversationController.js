const mongoose = require("mongoose");
const ConversationMember = require("../models/ConversationMember");
const Conversation = require("../models/Conversation");

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

module.exports = { listMine };
