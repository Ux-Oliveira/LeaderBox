import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();

const {
  TIKTOK_CLIENT_KEY,
  TIKTOK_CLIENT_SECRET,
  TIKTOK_REDIRECT_URI,
  TIKTOK_TOKEN_URL = "https://open.tiktokapis.com/v2/oauth/token/"
} = process.env;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const { code, code_verifier } = req.body;
    if (!code) return res.status(400).json({ error: "Missing code" });

    // ✅ URL-encoded body
    const body = new URLSearchParams({
      client_key: TIKTOK_CLIENT_KEY,
      client_secret: TIKTOK_CLIENT_SECRET,
      code,
      grant_type: "authorization_code",
      redirect_uri: TIKTOK_REDIRECT_URI,
    });

    if (code_verifier) body.append("code_verifier", code_verifier);

    const tokenRes = await fetch(TIKTOK_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });

    const data = await tokenRes.json();

    if (!tokenRes.ok || data.error) {
      console.error("TikTok token error:", data);
      return res.status(tokenRes.status || 502).json({
        error: data.message || "TikTok token exchange failed",
        body: data
      });
    }

    // Optional: set session cookie
    res.status(200).json(data);

  } catch (err) {
    console.error("Exchange error:", err);
    res.status(500).json({ error: "Server error", details: err.message });
  }
}
