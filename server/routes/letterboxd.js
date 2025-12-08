// server/routes/letterboxd.js
import express from "express";
import fetch from "node-fetch"; // ensure this is in package.json (node-fetch)
import dotenv from "dotenv";
dotenv.config();

const router = express.Router();

const AUTH0_DOMAIN = process.env.AUTH0_DOMAIN || process.env.LETTERBOXD_AUTH0_DOMAIN;
const AUTH0_CLIENT_ID = process.env.AUTH0_CLIENT_ID || process.env.LETTERBOXD_CLIENT_ID;
const AUTH0_CLIENT_SECRET = process.env.AUTH0_CLIENT_SECRET || process.env.LETTERBOXD_CLIENT_SECRET;
const AUTH0_TOKEN_URL = `https://${AUTH0_DOMAIN}/oauth/token`;
const AUTH0_USERINFO = `https://${AUTH0_DOMAIN}/userinfo`;

router.post("/exchange", async (req, res) => {
  try {
    const { code, code_verifier } = req.body || {};
    if (!code || !code_verifier) return res.status(400).json({ error: "missing_code_or_verifier" });
    if (!AUTH0_DOMAIN || !AUTH0_CLIENT_ID || !AUTH0_CLIENT_SECRET) {
      return res.status(500).json({ error: "server_misconfigured", detail: "Missing Auth0 creds in env" });
    }

    // Exchange code for tokens at Auth0 token endpoint using PKCE
    const params = {
      grant_type: "authorization_code",
      client_id: AUTH0_CLIENT_ID,
      client_secret: AUTH0_CLIENT_SECRET, // safe on server
      code,
      code_verifier,
      redirect_uri: process.env.VITE_LETTERBOXD_REDIRECT_URI
    };

    const tokenRes = await fetch(AUTH0_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });

    const tokenJson = await tokenRes.json();
    if (!tokenRes.ok) {
      console.error("Auth0 token error:", tokenJson);
      return res.status(502).json({ error: "token_exchange_failed", detail: tokenJson });
    }

    // optionally fetch userinfo
    let profile = null;
    try {
      const uiRes = await fetch(AUTH0_USERINFO, {
        method: "GET",
        headers: { Authorization: `Bearer ${tokenJson.access_token}` },
      });
      if (uiRes.ok) {
        profile = await uiRes.json();
      } else {
        // fallback: inspect id_token (JWT) for sub/name picture
        try {
          profile = { sub: tokenJson.id_token || tokenJson.id_token };
        } catch (e) { profile = null; }
      }
    } catch (err) {
      console.warn("Failed fetching userinfo:", err);
    }

    // Normalize to shape your app expects
    const normalized = {
      open_id: profile && (profile.sub || profile.user_id || tokenJson.sub) || tokenJson.id_token || null,
      nickname: profile && (profile.nickname || profile.name || profile.email) || null,
      avatar: profile && (profile.picture || profile.avatar) || null,
      raw: { tokenResponse: tokenJson, userinfo: profile },
    };

    return res.json({ tokens: tokenJson, profile: normalized });
  } catch (err) {
    console.error("Letterboxd exchange error:", err);
    return res.status(500).json({ error: "internal_server_error", message: String(err) });
  }
});

export default router;
