// api/auth/tiktok/exchange.js
import fetch from "node-fetch";

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method Not Allowed" });
    }

    const { code, code_verifier, redirect_uri } = req.body || {};

    if (!code || !code_verifier || !redirect_uri) {
      return res.status(400).json({ error: "Missing code, code_verifier or redirect_uri" });
    }

    // env keys must be set in Vercel dashboard (or .env for local)
    const {
      TIKTOK_CLIENT_KEY,
      TIKTOK_CLIENT_SECRET,
      TIKTOK_TOKEN_URL = "https://open.tiktokapis.com/v2/oauth/token"
    } = process.env;

    if (!TIKTOK_CLIENT_KEY || !TIKTOK_CLIENT_SECRET) {
      console.error("Missing TIKTOK_CLIENT_KEY or TIKTOK_CLIENT_SECRET");
      return res.status(500).json({ error: "Server config missing" });
    }

    // Build urlencoded form body (TikTok expects form data)
    const params = new URLSearchParams();
    params.append("client_key", TIKTOK_CLIENT_KEY);
    params.append("client_secret", TIKTOK_CLIENT_SECRET);
    params.append("grant_type", "authorization_code");
    params.append("code", code);
    params.append("redirect_uri", redirect_uri);
    params.append("code_verifier", code_verifier);

    console.log("[exchange] Posting to token endpoint:", TIKTOK_TOKEN_URL);
    console.log("[exchange] Payload (partial):", {
      client_key: TIKTOK_CLIENT_KEY,
      code: code.slice(0, 8) + "...",
      redirect_uri,
      has_code_verifier: !!code_verifier
    });

    const tokenRes = await fetch(TIKTOK_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });

    const text = await tokenRes.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      data = { raw: text };
    }

    if (!tokenRes.ok || data.error) {
      console.error("[exchange] TikTok token error:", tokenRes.status, data);
      return res.status(tokenRes.status || 502).json({ error: "TikTok token exchange failed", body: data });
    }

    // success — you can set a cookie/session here if desired
    // example: res.cookie("sessionId", "generated", { httpOnly: true });

    return res.status(200).json({ ok: true, tokens: data, redirectUrl: "/" });
  } catch (err) {
    console.error("[exchange] unexpected error:", err);
    return res.status(500).json({ error: "Internal server error", details: String(err) });
  }
}
