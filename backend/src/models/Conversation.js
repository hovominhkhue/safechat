const mongoose = require("mongoose");

const ConversationSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["DM", "GROUP"],
      required: true,
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

// Validation simple : title obligatoire si GROUP
ConversationSchema.pre("validate", function () {
  if (this.type === "GROUP" && !this.title) {
    this.invalidate("title", "title is required for GROUP conversations");
  }
});

module.exports = mongoose.model("Conversation", ConversationSchema);