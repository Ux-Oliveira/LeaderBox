// server/api/auth/tiktok/callback.js
import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();

const router = express.Router();

/**
 * Server-side callback handler.
 * This is used if TikTok redirects directly to your backend (server-side flow).
 * It accepts query params: ?code=...&state=...
 * Then exchanges the code for tokens (using client_secret) and finally redirects
 * back to your frontend (you can change the redirect destination below).
 */
router.get("/callback", async (req, res) => {
  try {
    const authCode = req.query.code;
    const returnedState = req.query.state;

    if (!authCode) {
      return res.status(400).send("Missing authorization code");
    }

    // Use server env values
    const {
      TIKTOK_CLIENT_KEY,
      TIKTOK_CLIENT_SECRET,
      TIKTOK_REDIRECT_URI,
      TIKTOK_TOKEN_URL = "https://open.tiktokapis.com/v2/oauth/token"
    } = process.env;

    // Build form body
    const params = new URLSearchParams();
    params.append("client_key", TIKTOK_CLIENT_KEY);
    if (TIKTOK_CLIENT_SECRET) params.append("client_secret", TIKTOK_CLIENT_SECRET);
    params.append("grant_type", "authorization_code");
    params.append("code", authCode);
    params.append("redirect_uri", TIKTOK_REDIRECT_URI);

    // If you stored code_verifier server-side, append it here.
    // For a server-side redirect flow you would need to save code_verifier for this session.
    // If you don't use PKCE server-side, skip it.
    // params.append("code_verifier", savedVerifier);

    const tokenRes = await fetch(TIKTOK_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString()
    });

    const text = await tokenRes.text();
    let tokenJson;
    try {
      tokenJson = JSON.parse(text);
    } catch (e) {
      tokenJson = { raw: text };
    }

    if (!tokenRes.ok) {
      console.error("Token exchange failed:", tokenRes.status, text);
      return res.status(502).send("TikTok token exchange failed");
    }

    // tokenJson contains access_token, refresh_token, open_id, etc.
    // TODO: create session, persist tokens, lookup/create user.

    // Redirect to your frontend with a short success flag (or to whatever page you want)
    // Note: do NOT send secrets in the URL. Better: create session on server and redirect
    return res.redirect("/?tiktok=success");
  } catch (err) {
    console.error("Callback error:", err);
    return res.status(500).send("Server error on callback");
  }
});

export default router;
