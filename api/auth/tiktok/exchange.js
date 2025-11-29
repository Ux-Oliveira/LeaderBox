// /api/auth/tiktok/exchange.js
// Vercel serverless function - ESM
import dotenv from "dotenv";
dotenv.config();

const {
  TIKTOK_CLIENT_KEY,
  TIKTOK_CLIENT_SECRET,
  TIKTOK_REDIRECT_URI,
  TIKTOK_TOKEN_URL = "https://open.tiktokapis.com/v2/oauth/token"
} = process.env;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const body = req.body || {};
    const { code, code_verifier, redirect_uri } = body;

    console.log("Exchange handler incoming:", { hasCode: !!code, hasVerifier: !!code_verifier });

    if (!code) return res.status(400).json({ error: "Missing authorization code" });

    const effectiveRedirectUri = redirect_uri || TIKTOK_REDIRECT_URI;
    if (!effectiveRedirectUri) {
      console.error("Missing redirect URI in env or request");
      return res.status(400).json({ error: "Missing redirect_uri (server not configured)" });
    }

    if (!TIKTOK_CLIENT_KEY || !TIKTOK_CLIENT_SECRET) {
      console.error("Missing TikTok credentials in env", { TIKTOK_CLIENT_KEY: !!TIKTOK_CLIENT_KEY, TIKTOK_CLIENT_SECRET: !!TIKTOK_CLIENT_SECRET });
      return res.status(500).json({ error: "TikTok configuration missing on server" });
    }

    // Build x-www-form-urlencoded body
    const params = new URLSearchParams();
    params.append("client_key", TIKTOK_CLIENT_KEY);
    params.append("client_secret", TIKTOK_CLIENT_SECRET);
    params.append("grant_type", "authorization_code");
    params.append("code", code);
    params.append("redirect_uri", effectiveRedirectUri);
    if (code_verifier) params.append("code_verifier", code_verifier);

    console.log("Posting to TikTok token url:", TIKTOK_TOKEN_URL);
    console.log("Request params:", params.toString().slice(0, 400)); // safe length

    // Use global fetch (Vercel/Node 18+). No node-fetch required.
    const tokenRes = await fetch(TIKTOK_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });

    const text = await tokenRes.text();
    let tokenData;
    try {
      tokenData = JSON.parse(text);
    } catch (e) {
      tokenData = { raw: text };
    }

    if (!tokenRes.ok) {
      console.error("TikTok token exchange failed:", tokenRes.status, tokenData);
      return res.status(tokenRes.status || 502).json({ error: "TikTok token exchange failed", body: tokenData });
    }

    console.log("TikTok token success:", Object.keys(tokenData).join(", "));

    // Optionally: create cookie/session here.
    return res.status(200).json({ ok: true, tokens: tokenData, redirectUrl: "/" });
  } catch (err) {
    console.error("Exchange error:", err);
    return res.status(500).json({ error: "Internal server error", details: String(err) });
  }
}
