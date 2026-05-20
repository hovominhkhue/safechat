const mongoose = require("mongoose");
const Channel = require("../models/Channel");
const Conversation = require("../models/Conversation");
const ConversationMember = require("../models/ConversationMember");

async function listAll(req, res) {
  try {
    const channels = await Channel.find({}).sort({ topic: 1 }).lean();

    if (channels.length === 0) {
      return res.status(200).json({ channels: [] });
    }

    const topics = channels.map((c) => c.topic);

    // 1 query: toutes les conversations CHANNEL pour ces topics
    const conversations = await Conversation.find({
      type: "CHANNEL",
      channelTopic: { $in: topics },
    }).lean();

    const convByTopic = {};
    for (const conv of conversations) {
      convByTopic[conv.channelTopic] = conv;
    }

    // 1 query: tous les memberships du user dans ces conversations
    const convIds = conversations.map((c) => c._id);
    const memberships =
      convIds.length > 0
        ? await ConversationMember.find({
            conversationId: { $in: convIds },
            userId: new mongoose.Types.ObjectId(req.user.userId),
          }).lean()
        : [];

    const joinedConvIds = new Set(memberships.map((m) => m.conversationId.toString()));

    const result = channels.map((ch) => {
      const conv = convByTopic[ch.topic];
      return {
        topic: ch.topic,
        name: ch.name,
        description: ch.description,
        isJoined: conv ? joinedConvIds.has(conv._id.toString()) : false,
        conversationId: conv ? conv._id.toString() : null,
      };
    });

    return res.status(200).json({ channels: result });
  } catch (e) {
    console.error("LIST_CHANNELS_FAILED:", e);
    return res.status(500).json({ error: "LIST_CHANNELS_FAILED", message: e.message });
  }
}

module.exports = { listAll };
