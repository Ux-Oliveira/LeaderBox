const express = require("express");
const fetch = require("node-fetch");
const router = express.Router();

router.get("/callback", async (req, res) => {
  const { code, state } = req.query;

  if (!code) {
    return res.status(400).send("Missing code");
  }

  try {
    // TikTok credentials
    const CLIENT_KEY = process.env.TIKTOK_CLIENT_KEY;
    const CLIENT_SECRET = process.env.TIKTOK_CLIENT_SECRET;
    const REDIRECT_URI = process.env.TIKTOK_REDIRECT_URI;

    // PKCE verifier stored in session on frontend
    const codeVerifier = req.session.tiktok_code_verifier;

    const tokenRes = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_key: CLIENT_KEY,
        client_secret: CLIENT_SECRET,
        code,
        redirect_uri: REDIRECT_URI,
        grant_type: "authorization_code",
        code_verifier: codeVerifier
      })
    });

    const tokenData = await tokenRes.json();

    if (!tokenData.access_token) {
      return res.status(400).json({ error: "Token exchange failed", tokenData });
    }

    // fetch user profile
    const userRes = await fetch("https://open.tiktokapis.com/v2/user/info/", {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
      },
    });

    const userData = await userRes.json();

    // store user in your DB...
    // or create a session...

    // FINALLY → redirect to your React dashboard
    res.redirect("https://www.leaderbox.co/");
  } catch (err) {
    console.error(err);
    res.status(500).send("OAuth callback error");
  }
});

module.exports = router;
