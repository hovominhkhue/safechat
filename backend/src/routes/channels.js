const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const channelController = require("../controllers/channelController");

router.get("/", auth, channelController.listAll);

module.exports = router;
