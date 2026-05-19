const express = require("express");
const authMiddleware = require("../middleware/auth");
const { listMine, createOrGetDm, createGroup, getById } = require("../controllers/conversationController");

const router = express.Router();

router.use(authMiddleware);

router.get("/", listMine);
router.post("/dm", createOrGetDm);
router.post("/group", createGroup);
router.get("/:id", getById);

module.exports = router;
