// server/api/auth/tiktok/callback.js

import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();
const router = express.Router();

router.get("/callback", async (req, res) => {
  const { code, state } = req.query;
  if (!code || !state) return res.status(400).send("Missing code or state");

  // code_verifier must come from the frontend PKCE flow
  const codeVerifier = state; // assuming you sent it as 'state'

  const params = new URLSearchParams();
  params.append("client_key", process.env.TIKTOK_CLIENT_KEY);
  params.append("client_secret", process.env.TIKTOK_CLIENT_SECRET);
  params.append("grant_type", "authorization_code");
  params.append("code", code);
  params.append("redirect_uri", process.env.TIKTOK_REDIRECT_URI);
  params.append("code_verifier", codeVerifier);

  try {
    const response = await fetch(process.env.TIKTOK_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params,
    });
    const data = await response.json();
    console.log("TikTok token:", data);

    if (!data.access_token) {
      return res.status(400).send("No access_token returned from exchange");
    }

    res.cookie("tiktok_tokens", JSON.stringify(data), { httpOnly: true });
    res.redirect("/");
  } catch (err) {
    console.error("TikTok callback exchange error:", err);
    res.status(500).send("TikTok exchange failed");
  }
});

export default router;
