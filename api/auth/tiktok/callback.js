// server/api/auth/tiktok/callback.js
import express from "express";
import { exchangeTikTokCode } from "../../../tiktok.js";

const router = express.Router();

router.get("/callback", async (req, res) => {
  const { code, state } = req.query;
  if (!code || !state) {
    return res.status(400).send("Missing code or state");
  }

  try {
    // Exchange code for tokens server-side
    const tokens = await exchangeTikTokCode({ code, code_verifier: null, redirect_uri: process.env.TIKTOK_REDIRECT_URI });
    
    // Store tokens if needed in a cookie/session
    res.cookie("tiktok_tokens", JSON.stringify(tokens), { httpOnly: true });

    // Redirect back to your frontend
    res.redirect("/");
  } catch (err) {
    console.error("TikTok callback exchange error:", err);
    res.status(500).send("TikTok exchange failed");
  }
});

export default router;
