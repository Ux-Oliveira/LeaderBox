// server/api/auth/tiktok/callback.js
import express from "express";
import { exchangeTikTokCode } from "../../../tiktok.js";

const router = express.Router();

router.get("/callback", async (req, res) => {
  const { code, state } = req.query;
  if (!code || !state) return res.status(400).send("Missing code or state");

  // Retrieve code_verifier from cookie
  const code_verifier = req.cookies[`tiktok_cv_${state}`];
  if (!code_verifier) return res.status(400).send("Missing code_verifier (expired or invalid)");

  try {
    const tokens = await exchangeTikTokCode({
      code,
      code_verifier,
      redirect_uri: process.env.TIKTOK_REDIRECT_URI
    });

    // Clear code_verifier cookie after use
    res.clearCookie(`tiktok_cv_${state}`);

    // Store tokens in a secure cookie
    res.cookie("tiktok_tokens", JSON.stringify(tokens), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });

    res.redirect("/"); // frontend home
  } catch (err) {
    console.error("TikTok callback exchange error:", err);
    res.status(500).send("TikTok exchange failed");
  }
});

export default router;
