require("dotenv").config();
const http = require("http");
const express = require("express");
const cors = require("cors");
const { Server } = require("socket.io");

const connectDB = require("./config/db");
const setupSockets = require("./sockets");

const app = express();
app.use(cors());
app.use(express.json());

app.use("/auth", require("./routes/auth"));
app.use("/conversations", require("./routes/conversations"));
app.use("/channels", require("./routes/channels"));

/** Health */
app.get("/health", (req, res) => res.json({ ok: true }));

/** HTTP + Socket.IO */
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });
setupSockets(io);

/** Start */
const PORT = process.env.PORT || 3001;

connectDB();
server.listen(PORT, () => console.log(`✅ Server on http://localhost:${PORT}`));
