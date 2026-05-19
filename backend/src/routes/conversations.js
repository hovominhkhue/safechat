const express = require("express");
const authMiddleware = require("../middleware/auth");
const { listMine, createOrGetDm } = require("../controllers/conversationController");

const router = express.Router();

router.use(authMiddleware);

router.get("/", listMine);
router.post("/dm", createOrGetDm);

module.exports = router;
