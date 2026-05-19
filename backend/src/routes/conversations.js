const express = require("express");
const authMiddleware = require("../middleware/auth");
const { listMine } = require("../controllers/conversationController");

const router = express.Router();

router.use(authMiddleware);

router.get("/", listMine);

module.exports = router;
