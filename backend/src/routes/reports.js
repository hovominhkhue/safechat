const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const reportController = require("../controllers/reportController");

router.post("/", auth, reportController.create);

module.exports = router;
