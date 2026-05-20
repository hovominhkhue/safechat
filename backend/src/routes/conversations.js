const express = require("express");
const authMiddleware = require("../middleware/auth");
const { listMine, createOrGetDm, createGroup, getById, addMember, removeMember, listMessages } = require("../controllers/conversationController");

const router = express.Router();

router.use(authMiddleware);

router.get("/", listMine);
router.post("/dm", createOrGetDm);
router.post("/group", createGroup);
router.get("/:id", getById);
router.get("/:id/messages", listMessages);
router.post("/:id/members", addMember);
router.delete("/:id/members/:userId", removeMember);

module.exports = router;
