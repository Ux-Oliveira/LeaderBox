// serverless function: /api/auth/tiktok/exchange.js
import fetch from "node-fetch";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const { code, code_verifier } = req.body;

    if (!code) {
      return res.status(400).json({ error: "Missing authorization code" });
    }
    if (!code_verifier) {
      return res.status(400).json({ error: "Missing code_verifier" });
    }

    const {
      TIKTOK_CLIENT_KEY,
      TIKTOK_CLIENT_SECRET,
      TIKTOK_REDIRECT_URI,
      TIKTOK_TOKEN_URL = "https://open.tiktokapis.com/v2/oauth/token/"
    } = process.env;

    if (!TIKTOK_CLIENT_KEY || !TIKTOK_CLIENT_SECRET || !TIKTOK_REDIRECT_URI) {
      console.error("❌ TikTok env vars missing:", { TIKTOK_CLIENT_KEY, TIKTOK_CLIENT_SECRET, TIKTOK_REDIRECT_URI });
      return res.status(500).json({ error: "TikTok server configuration missing" });
    }

    // Build URL-encoded body for TikTok
    const params = new URLSearchParams();
    params.append("client_key", TIKTOK_CLIENT_KEY);
    params.append("client_secret", TIKTOK_CLIENT_SECRET);
    params.append("code", code);
    params.append("grant_type", "authorization_code");
    params.append("redirect_uri", TIKTOK_REDIRECT_URI);
    params.append("code_verifier", code_verifier);

    console.log("Posting to TikTok token URL:", TIKTOK_TOKEN_URL);
    console.log("Request body:", params.toString());

    const tokenRes = await fetch(TIKTOK_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });

    let data;
    try {
      data = await tokenRes.json();
    } catch (err) {
      console.error("Failed parsing TikTok response as JSON:", err);
      return res.status(502).json({ error: "TikTok returned invalid JSON", details: err.message });
    }

    if (!tokenRes.ok || data.error) {
      console.error("TikTok token exchange error:", data);
      return res.status(tokenRes.status || 502).json({
        error: "TikTok token exchange failed",
        body: data
      });
    }

    console.log("TikTok token exchange successful:", data);

    // Optionally, you can set a cookie for the session here
    // res.cookie("sessionId", "your-generated-id", { httpOnly: true, secure: true });

    return res.status(200).json({ ok: true, tokens: data });

  } catch (err) {
    console.error("Exchange function error:", err);
    return res.status(500).json({ error: "Server error", details: err.message });
  }
}
