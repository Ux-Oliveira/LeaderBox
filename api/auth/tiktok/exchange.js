// /api/auth/tiktok/exchange.js
// Serverless handler for Vercel (ESM)
// IMPORTANT: do NOT import node-fetch here; use global fetch (Node 18+ on Vercel)

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return res.status(405).json({ error: "Method Not Allowed" });
    }

    // parse incoming JSON body (Vercel provides parsed req.body)
    const { code, code_verifier, redirect_uri } = req.body || {};

    console.log("[exchange] incoming body:", { code: !!code, code_verifier: !!code_verifier, redirect_uri });

    if (!code) {
      console.warn("[exchange] missing code in request body");
      return res.status(400).json({ error: "Missing authorization code" });
    }
    if (!code_verifier) {
      console.warn("[exchange] missing code_verifier in request body");
      return res.status(400).json({ error: "Missing code_verifier (PKCE)" });
    }

    // env
    const {
      TIKTOK_CLIENT_KEY,
      TIKTOK_CLIENT_SECRET,
      TIKTOK_REDIRECT_URI,
      TIKTOK_TOKEN_URL = "https://open.tiktokapis.com/v2/oauth/token"
    } = process.env;

    console.log("[exchange] env presence:", {
      hasClientKey: !!TIKTOK_CLIENT_KEY,
      hasClientSecret: !!TIKTOK_CLIENT_SECRET,
      hasRedirectUri: !!TIKTOK_REDIRECT_URI,
      tokenUrl: TIKTOK_TOKEN_URL
    });

    if (!TIKTOK_CLIENT_KEY || !TIKTOK_CLIENT_SECRET) {
      console.error("[exchange] Missing TikTok client key/secret in env");
      return res.status(500).json({ error: "Server misconfiguration: missing TikTok credentials" });
    }

    const effectiveRedirect = redirect_uri || TIKTOK_REDIRECT_URI;
    if (!effectiveRedirect) {
      console.error("[exchange] Missing redirect_uri (no fallback)");
      return res.status(400).json({ error: "Missing redirect_uri" });
    }

    // Build URL-encoded body for TikTok
    const params = new URLSearchParams();
    params.append("client_key", TIKTOK_CLIENT_KEY);
    params.append("client_secret", TIKTOK_CLIENT_SECRET);
    params.append("grant_type", "authorization_code");
    params.append("code", code);
    params.append("redirect_uri", effectiveRedirect);
    params.append("code_verifier", code_verifier);

    const tokenUrl = TIKTOK_TOKEN_URL;

    console.log("[exchange] posting to TikTok token endpoint:", tokenUrl);
    console.log("[exchange] request body (trimmed):", params.toString().slice(0, 1000));

    // Use global fetch (Node 18+). Explicitly set content-type application/x-www-form-urlencoded
    const tokenRes = await fetch(tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: params.toString(),
      // no credentials here; this is server-to-server
    });

    const text = await tokenRes.text().catch(err => {
      console.error("[exchange] failed to read token response body text:", err);
      return null;
    });

    // Try parse JSON, fallback to raw text
    let tokenData;
    try {
      tokenData = text ? JSON.parse(text) : null;
    } catch (err) {
      tokenData = { raw: text };
    }

    console.log("[exchange] token endpoint status:", tokenRes.status, "body:", tokenData);

    if (!tokenRes.ok) {
      // Return TikTok response body for easier debugging
      return res.status(tokenRes.status || 502).json({
        error: "TikTok token exchange failed",
        status: tokenRes.status,
        body: tokenData
      });
    }

    // Success: tokenData should contain access_token / refresh_token / open_id etc.
    // Here you would normally create a session, save tokens, create user record, etc.
    // For now, set a session cookie (optional) or just return tokens.

    // Example: set a non-sensitive session cookie placeholder (optional)
    // res.setHeader("Set-Cookie", `sessionId=${someId}; HttpOnly; Path=/; Max-Age=604800; Secure; SameSite=Lax`);

    return res.status(200).json({ ok: true, tokens: tokenData });
  } catch (err) {
    // Catch everything and return a JSON error — avoid crashing the function
    console.error("[exchange] unexpected error:", err && err.stack ? err.stack : err);
    return res.status(500).json({ error: "Internal server error", details: String(err) });
  }
}
