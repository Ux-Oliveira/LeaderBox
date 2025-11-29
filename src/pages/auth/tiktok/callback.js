// server/api/auth/tiktok/callback.js  (for your express server)
import express from "express";
const router = express.Router();

router.get("/callback", async (req, res) => {
  try {
    const authCode = req.query.code;
    if (!authCode) return res.status(400).send("Missing code");

    const { TIKTOK_CLIENT_KEY, TIKTOK_CLIENT_SECRET, TIKTOK_REDIRECT_URI, TIKTOK_TOKEN_URL = "https://open.tiktokapis.com/v2/oauth/token" } = process.env;
    if (!TIKTOK_CLIENT_KEY || !TIKTOK_CLIENT_SECRET || !TIKTOK_REDIRECT_URI) {
      console.error("[callback] Missing env vars.");
      return res.status(500).send("Server misconfiguration");
    }

    const params = new URLSearchParams();
    params.append("client_key", TIKTOK_CLIENT_KEY);
    params.append("client_secret", TIKTOK_CLIENT_SECRET);
    params.append("grant_type", "authorization_code");
    params.append("code", authCode);
    params.append("redirect_uri", TIKTOK_REDIRECT_URI);

    const tokenRes = await fetch(TIKTOK_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", "Accept": "application/json" },
      body: params.toString()
    });

    const text = await tokenRes.text();
    let data;
    try { data = text ? JSON.parse(text) : {}; } catch (e) { data = { raw: text }; }

    if (!tokenRes.ok) {
      console.error("[callback] TikTok exchange failed:", tokenRes.status, data);
      return res.status(502).send("TikTok token exchange failed");
    }

    // TODO: create a session & redirect safely
    return res.redirect("/?tiktok=success");
  } catch (err) {
    console.error("[callback] error:", err);
    return res.status(500).send("Server error");
  }
});

export default router;
