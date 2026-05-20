const mongoose = require("mongoose");

const TOPICS = ["IA", "BACKEND", "FRONTEND", "DEVOPS", "ETUDES", "PROJETS"];

const ChannelSchema = new mongoose.Schema(
  {
    topic: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,           // normalise automatiquement en MAJUSCULES
      enum: TOPICS,              // refuse tout autre topic
    },
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: "" },
  },
  { timestamps: true }
);

// Export aussi la liste pour la réutiliser ailleurs (controllers, seed)
ChannelSchema.statics.TOPICS = TOPICS;

module.exports = mongoose.model("Channel", ChannelSchema);
