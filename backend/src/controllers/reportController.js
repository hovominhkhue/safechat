const mongoose = require("mongoose");
const Report = require("../models/Report");
const Message = require("../models/Message");

async function create(req, res) {
  try {
    const { messageId, reason } = req.body;
    const reportedBy = new mongoose.Types.ObjectId(req.user.userId);

    if (!messageId || !mongoose.isValidObjectId(messageId)) {
      return res.status(400).json({ error: "BAD_REQUEST", message: "messageId invalide" });
    }

    if (!reason || typeof reason !== "string" || reason.trim().length < 3 || reason.trim().length > 500) {
      return res.status(400).json({ error: "BAD_REQUEST", message: "reason doit faire entre 3 et 500 caractères" });
    }

    const message = await Message.findById(messageId).lean();
    if (!message) {
      return res.status(404).json({ error: "MESSAGE_NOT_FOUND" });
    }

    if (message.senderId.toString() === req.user.userId) {
      return res.status(400).json({ error: "CANNOT_REPORT_OWN_MESSAGE" });
    }

    let report;
    try {
      report = await Report.create({
        messageId: new mongoose.Types.ObjectId(messageId),
        reportedBy,
        reason: reason.trim(),
      });
    } catch (e) {
      if (e.code === 11000) {
        return res.status(409).json({ error: "ALREADY_REPORTED" });
      }
      throw e;
    }

    await Message.updateOne({ _id: message._id }, { $set: { isReported: true } });

    return res.status(201).json({
      report: {
        id:         report._id.toString(),
        messageId:  report.messageId.toString(),
        reportedBy: report.reportedBy.toString(),
        reason:     report.reason,
        status:     report.status,
        createdAt:  report.createdAt,
      },
    });
  } catch (e) {
    console.error("CREATE_REPORT_FAILED:", e);
    return res.status(500).json({ error: "CREATE_REPORT_FAILED", message: e.message });
  }
}

module.exports = { create };
