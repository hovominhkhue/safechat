const mongoose = require("mongoose");

const ChannelSchema = new mongoose.Schema(
  {
    topic: { type: String, required: true, unique: true, trim: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: "" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Channel", ChannelSchema);
