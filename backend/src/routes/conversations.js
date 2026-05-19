const express = require("express");
const authMiddleware = require("../middleware/auth");
const { listMine, createOrGetDm, createGroup } = require("../controllers/conversationController");

const router = express.Router();

router.use(authMiddleware);

router.get("/", listMine);
router.post("/dm", createOrGetDm);
router.post("/group", createGroup);

module.exports = router;
