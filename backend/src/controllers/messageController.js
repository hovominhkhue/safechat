const mongoose = require("mongoose");
const Message = require("../models/Message");
const Report = require("../models/Report");

async function block(req, res) {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: "INVALID_ID" });
    }

    const message = await Message.findById(id).lean();
    if (!message) {
      return res.status(404).json({ error: "NOT_FOUND" });
    }

    // Idempotent : déjà bloqué
    if (message.moderation?.blocked) {
      return res.status(200).json({
        message: formatMessage(message),
        resolvedReportsCount: 0,
      });
    }

    await Message.updateOne(
      { _id: message._id },
      { $set: { "moderation.blocked": true } }
    );

    const updateResult = await Report.updateMany(
      { messageId: message._id, status: "OPEN" },
      {
        $set: {
          status: "RESOLVED",
          handledBy: new mongoose.Types.ObjectId(req.user.userId),
          handledAt: new Date(),
        },
      }
    );

    return res.status(200).json({
      message: formatMessage({ ...message, moderation: { ...message.moderation, blocked: true } }),
      resolvedReportsCount: updateResult.modifiedCount,
    });
  } catch (e) {
    console.error("BLOCK_MESSAGE_FAILED:", e);
    return res.status(500).json({ error: "BLOCK_MESSAGE_FAILED", message: e.message });
  }
}

function formatMessage(m) {
  return {
    id:             m._id.toString(),
    conversationId: m.conversationId.toString(),
    senderId:       m.senderId.toString(),
    content:        m.content,
    status:         m.moderation?.blocked ? "BLOCKED" : "SENT",
    isReported:     m.isReported,
    createdAt:      m.createdAt,
  };
}

module.exports = { block };
