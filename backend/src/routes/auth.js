const express = require("express");
const { requestOtp, verifyOtp, me } = require("../controllers/authController");
const authMiddleware = require("../middleware/auth");

const router = express.Router();

router.post("/request-otp", requestOtp);
router.post("/verify-otp", verifyOtp);
router.get("/me", authMiddleware, me);

module.exports = router;
