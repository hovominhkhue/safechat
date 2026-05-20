const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const requireRole = require("../middleware/requireRole");
const messageController = require("../controllers/messageController");

router.patch("/:id/block", auth, requireRole("MODERATOR", "ADMIN"), messageController.block);

module.exports = router;
