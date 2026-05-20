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

// Convention : topics stockés en minuscules.
// req.params.topic est normalisé .toLowerCase() avant toute recherche.
async function join(req, res) {
  try {
    const topic = req.params.topic.toLowerCase();
    const userId = new mongoose.Types.ObjectId(req.user.userId);

    const channel = await Channel.findOne({ topic }).lean();
    if (!channel) {
      return res.status(404).json({ error: "CHANNEL_NOT_FOUND" });
    }

    // Trouve ou crée (lazy) la Conversation CHANNEL
    let conv = await Conversation.findOne({ type: "CHANNEL", channelTopic: topic }).lean();
    let createdConv = false;

    if (!conv) {
      const created = await Conversation.create({
        type: "CHANNEL",
        channelTopic: topic,
        channelId: `channel_${topic}`,
        title: channel.name || `#${topic}`,
        createdBy: userId,
      });
      conv = created.toObject();
      createdConv = true;
    }

    // Idempotent : déjà membre
    const existing = await ConversationMember.findOne({
      conversationId: conv._id,
      userId,
    }).lean();

    if (existing) {
      return res.status(200).json({
        channel: {
          topic: channel.topic,
          name: channel.name,
          description: channel.description,
          conversationId: conv._id.toString(),
          isJoined: true,
        },
      });
    }

    // Crée le membership
    try {
      await ConversationMember.create({ conversationId: conv._id, userId, role: "MEMBER" });
    } catch (insertErr) {
      // Cleanup best-effort uniquement si on vient de créer cette conv
      if (createdConv) {
        await Conversation.deleteOne({ _id: conv._id }).catch(() => {});
      }
      throw insertErr;
    }

    return res.status(201).json({
      channel: {
        topic: channel.topic,
        name: channel.name,
        description: channel.description,
        conversationId: conv._id.toString(),
        isJoined: true,
      },
    });
  } catch (e) {
    console.error("JOIN_CHANNEL_FAILED:", e);
    return res.status(500).json({ error: "JOIN_CHANNEL_FAILED", message: e.message });
  }
}

module.exports = { listAll, join };
