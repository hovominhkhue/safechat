const mongoose = require("mongoose");

const ReportSchema = new mongoose.Schema(
  {
    messageId:  { type: mongoose.Schema.Types.ObjectId, ref: "Message", required: true },
    reportedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User",    required: true },
    reason:     { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ["OPEN", "REVIEWED", "RESOLVED", "REJECTED"],
      default: "OPEN",
    },
    handledBy:  { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    handledAt:  { type: Date },
  },
  { timestamps: true }
);

// Un user ne peut signaler un message qu'une seule fois
ReportSchema.index({ messageId: 1, reportedBy: 1 }, { unique: true });

module.exports = mongoose.model("Report", ReportSchema);
