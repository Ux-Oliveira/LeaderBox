// server/api/auth/tiktok/exchange.js
import fetch from "node-fetch";

export default async function handler(req, res) {
  const { code, code_verifier, redirect_uri } = req.body;

  if (!code || !code_verifier || !redirect_uri) {
    return res.status(400).json({ error: "Missing code, code_verifier or redirect_uri" });
  }

  const params = new URLSearchParams();
  params.append("client_key", process.env.VITE_TIKTOK_CLIENT_KEY);
  params.append("client_secret", process.env.TIKTOK_CLIENT_SECRET);
  params.append("grant_type", "authorization_code");
  params.append("code", code);
  params.append("redirect_uri", redirect_uri);
  params.append("code_verifier", code_verifier);

  try {
    const response = await fetch(process.env.TIKTOK_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params,
    });
    const data = await response.json();
    if (!response.ok) return res.status(response.status).json(data);
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: "Exchange failed", details: err.message });
  }
}
