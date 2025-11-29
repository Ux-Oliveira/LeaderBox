// /api/auth/tiktok/exchange.js
export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return res.status(405).json({ error: "Method Not Allowed" });
    }

    const { code, code_verifier, redirect_uri } = req.body || {};

    console.log("[exchange] received body keys:", {
      hasCode: !!code,
      hasVerifier: !!code_verifier,
      redirect_uri
    });

    if (!code) return res.status(400).json({ error: "Missing authorization code" });
    if (!code_verifier) return res.status(400).json({ error: "Missing code_verifier (PKCE)" });

    const {
      TIKTOK_CLIENT_KEY,
      TIKTOK_CLIENT_SECRET,
      TIKTOK_REDIRECT_URI,
      TIKTOK_TOKEN_URL = "https://open.tiktokapis.com/v2/oauth/token"
    } = process.env;

    console.log("[exchange] env present:", {
      hasClientKey: !!TIKTOK_CLIENT_KEY,
      hasClientSecret: !!TIKTOK_CLIENT_SECRET,
      hasRedirectUri: !!TIKTOK_REDIRECT_URI,
      tokenUrl: TIKTOK_TOKEN_URL
    });

    if (!TIKTOK_CLIENT_KEY || !TIKTOK_CLIENT_SECRET) {
      return res.status(500).json({ error: "Server misconfiguration: missing TikTok credentials" });
    }

    const effectiveRedirect = redirect_uri || TIKTOK_REDIRECT_URI;
    if (!effectiveRedirect) return res.status(400).json({ error: "Missing redirect_uri" });

    const params = new URLSearchParams();
    params.append("client_key", TIKTOK_CLIENT_KEY);
    params.append("client_secret", TIKTOK_CLIENT_SECRET);
    params.append("grant_type", "authorization_code");
    params.append("code", code);
    params.append("redirect_uri", effectiveRedirect);
    params.append("code_verifier", code_verifier);

    console.log("[exchange] posting to token URL:", TIKTOK_TOKEN_URL);
    // Node 18+ global fetch
    const tokenRes = await fetch(TIKTOK_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString()
    });

    const text = await tokenRes.text().catch(() => null);

    let tokenData;
    try { tokenData = text ? JSON.parse(text) : null; } catch (e) { tokenData = { raw: text }; }

    console.log("[exchange] token endpoint status:", tokenRes.status, "body:", tokenData);

    if (!tokenRes.ok) {
      return res.status(tokenRes.status || 502).json({
        error: "TikTok token exchange failed",
        status: tokenRes.status,
        body: tokenData
      });
    }

    // success
    return res.status(200).json({ ok: true, tokens: tokenData });
  } catch (err) {
    console.error("[exchange] unexpected error:", err && err.stack ? err.stack : err);
    return res.status(500).json({ error: "Internal server error", details: String(err) });
  }
}
