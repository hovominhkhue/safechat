require("dotenv").config();

const http = require("http");
const path = require("path");
const express = require("express");
const cors = require("cors");
const { Server } = require("socket.io");

const connectDB = require("./config/db");
const seedChannels = require("./scripts/seedChannels");
const setupSockets = require("./sockets");

const app = express();

app.use(cors());
app.use(express.json());

// Frontend folder: C:\safechat\frontend
const frontendPath = path.join(__dirname, "../../frontend");

// Désactive le cache en dev pour voir les modifications directement
app.use(
  express.static(frontendPath, {
    etag: false,
    lastModified: false,
    setHeaders: (res) => {
      res.setHeader("Cache-Control", "no-store");
    },
  })
);

// API routes
app.use("/auth", require("./routes/auth"));
app.use("/conversations", require("./routes/conversations"));
app.use("/channels", require("./routes/channels"));
app.use("/reports", require("./routes/reports"));
app.use("/moderation", require("./routes/moderation"));
app.use("/messages", require("./routes/messages"));

// Health check
app.get("/health", (req, res) => {
  res.json({ ok: true });
});

// Page principale
app.get("/", (req, res) => {
  res.sendFile(path.join(frontendPath, "index.html"));
});

// HTTP + Socket.IO
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

setupSockets(io);

// Start
const PORT = process.env.PORT || 3001;

connectDB().then(() => seedChannels().catch(console.error));

server.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
  console.log(`📁 Frontend served from: ${frontendPath}`);
});
