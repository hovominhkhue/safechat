const mongoose = require("mongoose");

const ConversationSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["DM", "GROUP", "CHANNEL"],
      required: true,
    },
    channelTopic: {
      type: String,
      trim: true,
    },
    channelId: {
      type: String,
      required: true,
    },
    title: {
      type: String,
      trim: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    dmKey: {
      type: String,
      index: true,
      sparse: true,
    },
    lastMessageAt: {
      type: Date,
    },
    lastMessagePreview: {
      type: String,
    },
    lastMessageSenderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    messageCount: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

ConversationSchema.index({ dmKey: 1 }, { unique: true, sparse: true });

ConversationSchema.pre("validate", function () {
  if (this.type === "GROUP" && !this.title) {
    this.invalidate("title", "title is required for GROUP conversations");
  }
  if (this.type === "CHANNEL" && !this.channelTopic) {
    this.invalidate("channelTopic", "channelTopic is required for CHANNEL conversations");
  }
});

module.exports = mongoose.model("Conversation", ConversationSchema);