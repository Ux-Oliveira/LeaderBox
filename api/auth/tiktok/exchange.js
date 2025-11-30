console.log("[exchange] TIKTOK_TOKEN_URL =", process.env.TIKTOK_TOKEN_URL);

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return res.status(405).json({ error: "Method Not Allowed" });
    }

    const { code, code_verifier, redirect_uri } = req.body || {};

    if (!code) return res.status(400).json({ error: "Missing code" });
    if (!code_verifier) return res.status(400).json({ error: "Missing code_verifier" });

    const TIKTOK_CLIENT_KEY = process.env.TIKTOK_CLIENT_KEY || process.env.VITE_TIKTOK_CLIENT_KEY;
    const TIKTOK_CLIENT_SECRET = process.env.TIKTOK_CLIENT_SECRET;
    const TIKTOK_TOKEN_URL = process.env.TIKTOK_TOKEN_URL || "https://open.tiktokapis.com/v2/oauth/token";

    if (!TIKTOK_CLIENT_KEY || !TIKTOK_CLIENT_SECRET) {
      console.error("[exchange] missing env vars:", { TIKTOK_CLIENT_KEY, TIKTOK_CLIENT_SECRET });
      return res.status(500).json({ error: "Server configuration missing" });
    }

    const params = new URLSearchParams();
    params.append("client_key", TIKTOK_CLIENT_KEY);
    params.append("client_secret", TIKTOK_CLIENT_SECRET);
    params.append("grant_type", "authorization_code");
    params.append("code", code);
    if (redirect_uri) params.append("redirect_uri", redirect_uri);
    params.append("code_verifier", code_verifier);

    console.log("[exchange] sending request to token endpoint:", TIKTOK_TOKEN_URL);

    const tokenRes = await fetch(TIKTOK_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString()
    });

    const text = await tokenRes.text();
    let data;
    try { data = JSON.parse(text); } catch (e) { data = { raw: text }; }

    if (!tokenRes.ok || data.error) {
      console.error("[exchange] TikTok token response error:", tokenRes.status, data);
      return res.status(tokenRes.status || 502).json({ error: "TikTok token exchange failed", body: data });
    }

    return res.status(200).json({ ok: true, tokens: data, redirectUrl: "/" });
  } catch (err) {
    console.error("[exchange] unexpected error:", err);
    return res.status(500).json({ error: "Internal server error", details: String(err) });
  }
}
