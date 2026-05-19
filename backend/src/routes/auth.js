const express = require("express");
const { requestOtp } = require("../controllers/authController");

const router = express.Router();

router.post("/request-otp", requestOtp);

module.exports = router;
