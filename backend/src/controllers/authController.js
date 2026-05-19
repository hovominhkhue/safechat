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

module.exports = { requestOtp };
