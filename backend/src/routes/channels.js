const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const channelController = require("../controllers/channelController");

router.get("/", auth, channelController.listAll);
router.post("/:topic/join", auth, channelController.join);

module.exports = router;
