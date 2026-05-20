const Report = require("../models/Report");

const VALID_STATUSES = ["OPEN", "REVIEWED", "RESOLVED", "REJECTED"];

async function listReports(req, res) {
  try {
    const { status = "OPEN", limit: limitRaw } = req.query;

    if (status !== "all" && !VALID_STATUSES.includes(status)) {
      return res.status(400).json({ error: "INVALID_STATUS" });
    }

    const limit = limitRaw !== undefined ? parseInt(limitRaw, 10) : 50;
    if (isNaN(limit) || limit < 1 || limit > 200) {
      return res.status(400).json({ error: "INVALID_LIMIT" });
    }

    const filter = status === "all" ? {} : { status };

    const raw = await Report.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate("reportedBy", "username")
      .populate("handledBy", "username")
      .populate({
        path: "messageId",
        populate: { path: "senderId", select: "username" },
      })
      .lean();

    const reports = raw.map((r) => {
      const msg = r.messageId;
      return {
        id:     r._id.toString(),
        status: r.status,
        reason: r.reason,
        createdAt: r.createdAt,
        message: msg
          ? {
              id:             msg._id.toString(),
              content:        msg.content,
              status:         msg.moderation?.blocked ? "BLOCKED" : "SENT",
              conversationId: msg.conversationId.toString(),
              createdAt:      msg.createdAt,
              sender: msg.senderId
                ? { id: msg.senderId._id.toString(), username: msg.senderId.username }
                : null,
            }
          : null,
        reporter: r.reportedBy
          ? { id: r.reportedBy._id.toString(), username: r.reportedBy.username }
          : null,
        handledBy: r.handledBy
          ? { id: r.handledBy._id.toString(), username: r.handledBy.username }
          : null,
        handledAt: r.handledAt || null,
      };
    });

    return res.status(200).json({ reports, total: reports.length });
  } catch (e) {
    console.error("LIST_REPORTS_FAILED:", e);
    return res.status(500).json({ error: "LIST_REPORTS_FAILED", message: e.message });
  }
}

module.exports = { listReports };
