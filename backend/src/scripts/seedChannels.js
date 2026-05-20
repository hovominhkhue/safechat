require("dotenv").config();
const mongoose = require("mongoose");
const Channel = require("../models/Channel");

const CHANNELS = [
  { topic: "general", name: "General", description: "General discussion for everyone" },
  { topic: "engineering", name: "Engineering", description: "Technical engineering topics" },
  { topic: "product", name: "Product", description: "Product updates and discussions" },
  { topic: "design", name: "Design", description: "UI/UX design discussions" },
  { topic: "devops", name: "DevOps", description: "Infrastructure and deployment" },
  { topic: "random", name: "Random", description: "Off-topic and fun discussions" },
];

async function seed() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("✅ MongoDB connected");

  const count = await Channel.countDocuments();
  if (count > 0) {
    console.log(`ℹ️  ${count} channels already in DB — skipping seed.`);
    await mongoose.disconnect();
    return;
  }

  await Channel.insertMany(CHANNELS);
  console.log(`✅ ${CHANNELS.length} channels seeded.`);
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
