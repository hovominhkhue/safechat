const jwt = require("jsonwebtoken");
const User = require("../models/User");

async function requestOtp(req, res) {
  try {
    const { phone } = req.body;

    if (!phone || typeof phone !== "string") {
      return res.status(400).json({ error: "BAD_REQUEST", message: "phone est requis et doit être une string" });
    }

    const trimmedPhone = phone.trim();

    let user = await User.findOne({ phone: trimmedPhone });

    if (!user) {
      const suffix = trimmedPhone.replace(/\D/g, "").slice(-6);
      user = await User.create({
        phone: trimmedPhone,
        username: `user_${suffix}`,
        role: "USER",
      });
    }

    return res.status(200).json({ ok: true, message: "OTP envoyé (simulé: 123456)" });
  } catch (e) {
    console.error("REQUEST_OTP_FAILED:", e);
    return res.status(500).json({ error: "REQUEST_OTP_FAILED", message: e.message });
  }
}

async function verifyOtp(req, res) {
  try {
    const { phone, otp } = req.body;

    if (!phone || !otp) {
      return res.status(400).json({ error: "BAD_REQUEST", message: "phone et otp sont requis" });
    }

    const user = await User.findOne({ phone: phone.trim() });

    if (!user) {
      return res.status(404).json({ error: "USER_NOT_FOUND" });
    }

    if (otp !== process.env.OTP_FAKE_CODE) {
      return res.status(401).json({ error: "INVALID_OTP" });
    }

    const token = jwt.sign(
      { userId: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    return res.status(200).json({
      token,
      user: {
        id: user._id,
        phone: user.phone,
        username: user.username,
        role: user.role,
      },
    });
  } catch (e) {
    console.error("VERIFY_OTP_FAILED:", e);
    return res.status(500).json({ error: "VERIFY_OTP_FAILED", message: e.message });
  }
}

async function me(req, res) {
  try {
    const user = await User.findById(req.user.userId).lean();

    if (!user) {
      return res.status(404).json({ error: "USER_NOT_FOUND" });
    }

    return res.status(200).json({
      user: {
        id: user._id,
        phone: user.phone,
        username: user.username,
        role: user.role,
      },
    });
  } catch (e) {
    console.error("ME_FAILED:", e);
    return res.status(500).json({ error: "ME_FAILED", message: e.message });
  }
}

module.exports = { requestOtp, verifyOtp, me };
