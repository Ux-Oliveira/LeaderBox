// api/auth/tiktok/exchange.js
import fetch from "node-fetch";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { code, code_verifier, redirect_uri } = req.body;

    if (!code || !code_verifier || !redirect_uri)
      return res.status(400).json({ error: "Missing required parameters" });

    const {
      TIKTOK_CLIENT_KEY,
      TIKTOK_CLIENT_SECRET,
      TIKTOK_TOKEN_URL = "https://open.tiktokapis.com/v2/oauth/token"
    } = process.env;

    const params = new URLSearchParams();
    params.append("client_key", TIKTOK_CLIENT_KEY);
    params.append("client_secret", TIKTOK_CLIENT_SECRET);
    params.append("grant_type", "authorization_code");
    params.append("code", code);
    params.append("redirect_uri", redirect_uri);
    params.append("code_verifier", code_verifier);

    const tokenRes = await fetch(TIKTOK_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString()
    });

    const text = await tokenRes.text();
    const tokenJson = tokenRes.ok ? JSON.parse(text) : null;

    if (!tokenRes.ok) return res.status(502).json({ error: "Token exchange failed", details: text });

    // TODO: create session, persist tokens, return user info
    return res.status(200).json({ redirectUrl: "/", tokenData: tokenJson });
  } catch (err) {
    console.error("Exchange error:", err);
    return res.status(500).json({ error: "Server error", details: err.message });
  }
}
