import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();

const router = express.Router();

/**
 * POST /auth/tiktok/exchange
 * Expects JSON body: { code, code_verifier?, redirect_uri? }
 * Exchanges authorization code for TikTok tokens (form-encoded to TikTok).
 */
router.post("/exchange", async (req, res) => {
  try {
    if (!req.body) {
      return res.status(400).json({ error: "Missing request body" });
    }

    const { code, code_verifier, redirect_uri } = req.body;

    if (!code) {
      return res.status(400).json({ error: "Missing code parameter" });
    }

    const tokenUrl = process.env.TIKTOK_TOKEN_URL || "https://open.tiktokapis.com/v2/oauth/token";
    const clientKey = process.env.TIKTOK_CLIENT_KEY || process.env.VITE_TIKTOK_CLIENT_KEY;
    const clientSecret = process.env.TIKTOK_CLIENT_SECRET;

    if (!clientKey || !clientSecret) {
      console.error("[exchange] Missing TikTok client key/secret in env");
      return res.status(500).json({ error: "Server configuration missing" });
    }

    const params = new URLSearchParams();
    params.append("client_key", clientKey);
    params.append("client_secret", clientSecret);
    params.append("grant_type", "authorization_code");
    params.append("code", code);
    if (redirect_uri) params.append("redirect_uri", redirect_uri);
    if (code_verifier) params.append("code_verifier", code_verifier);

    console.log("[exchange] request to tokenUrl:", tokenUrl);

    const tokenRes = await fetch(tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString()
    });

    const text = await tokenRes.text();
    let data;
    try { data = JSON.parse(text); } catch (e) { data = { raw: text }; }

    if (!tokenRes.ok || data.error) {
      console.error("[exchange] TikTok token error:", tokenRes.status, data);
      return res.status(tokenRes.status || 502).json({ error: "TikTok token exchange failed", body: data });
    }

    // Success — return tokens
    return res.status(200).json({ ok: true, tokens: data, redirectUrl: "/" });
  } catch (err) {
    console.error("[exchange] unexpected error:", err);
    return res.status(500).json({ error: "Internal server error", details: String(err) });
  }
});

export default router;
