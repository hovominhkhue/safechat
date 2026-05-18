const mongoose = require("mongoose");

const MessageSchema = new mongoose.Schema(
  {
    conversationId: { type: mongoose.Schema.Types.ObjectId, ref: "Conversation", required: true },
    senderId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    content: { type: String, required: true, trim: true },
    contentType: { type: String, enum: ["TEXT"], default: "TEXT", required: true },

    // (Optionnel) modération MVP
    moderation: {
      blocked: { type: Boolean, default: false },
      reason: { type: String },
    },
  },
  { timestamps: { createdAt: "createdAt", updatedAt: false } }
);

// Optimiser historique/pagination
MessageSchema.index({ conversationId: 1, createdAt: 1 });

module.exports = mongoose.model("Message", MessageSchema);