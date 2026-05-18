const mongoose = require("mongoose");

const ConversationMemberSchema = new mongoose.Schema(
  {
    conversationId: { type: mongoose.Schema.Types.ObjectId, ref: "Conversation", required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    role: {
      type: String,
      enum: ["OWNER", "MEMBER"],
      default: "MEMBER",
      required: true,
    },

    joinedAt: { type: Date, default: Date.now, required: true },
  },
  { timestamps: true }
);

// Empêcher double membre
ConversationMemberSchema.index({ conversationId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model("ConversationMember", ConversationMemberSchema);