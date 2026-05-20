const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const requireRole = require("../middleware/requireRole");
const moderationController = require("../controllers/moderationController");

router.get(
  "/reports",
  auth,
  requireRole("MODERATOR", "ADMIN"),
  moderationController.listReports
);

module.exports = router;
