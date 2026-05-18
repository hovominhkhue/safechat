const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, trim: true },
    phone: { type: String, unique: true, sparse: true },
    role: {
      type: String,
      enum: ["USER", "MOD", "ADMIN"],
      default: "USER",
      required: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", UserSchema);