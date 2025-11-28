import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();

const router = express.Router();

router.get("/callback", async (req, res) => {
  const authCode = req.query.code;
  const codeVerifier = req.query.state; // passed from frontend

  if (!authCode) {
    return res.status(400).send("Missing code from TikTok");
  }

  const params = new URLSearchParams();
  params.append("client_key", process.env.TIKTOK_CLIENT_KEY);
  params.append("client_secret", process.env.TIKTOK_CLIENT_SECRET);
  params.append("grant_type", "authorization_code");
  params.append("code", authCode);
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

    if (data.error) return res.status(400).send(data);

    // redirect with token to frontend
    res.redirect(`/tiktok/success?token=${data.access_token}`);

  } catch (err) {
    console.error(err);
    res.status(500).send("Server error");
  }
});

export default router;
