require("dotenv").config();
const mongoose = require("mongoose");
const Channel = require("../models/Channel");
const connectDB = require("../config/db");

const CHANNELS = [
  { topic: "IA", name: "Intelligence Artificielle", description: "Discussions IA, ML, LLM" },
  { topic: "BACKEND", name: "Backend", description: "APIs, bases de données, architecture serveur" },
  { topic: "FRONTEND", name: "Frontend", description: "UI, UX, frameworks front" },
  { topic: "DEVOPS", name: "DevOps", description: "CI/CD, Docker, cloud, monitoring" },
  { topic: "ETUDES", name: "Études", description: "Cours, projets école, ressources d'apprentissage" },
  { topic: "PROJETS", name: "Projets", description: "Partage de side-projects et collaborations" },
];

async function seedChannels() {
  for (const c of CHANNELS) {
    const existing = await Channel.findOne({ topic: c.topic });
    if (existing) {
      console.log(`SKIP : ${c.topic} existe déjà`);
    } else {
      await Channel.create(c);
      console.log(`CREATED : ${c.topic}`);
    }
  }
  const total = await Channel.countDocuments();
  console.log(`✅ ${total} channels en base`);
}

module.exports = seedChannels;

// Exécution directe : node seedChannels.js
if (require.main === module) {
  (async () => {
    try {
      await connectDB();
      await seedChannels();
    } catch (e) {
      console.error("❌ Seed failed:", e);
      process.exit(1);
    } finally {
      await mongoose.disconnect();
    }
  })();
}
