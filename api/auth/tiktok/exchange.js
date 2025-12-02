// /api/auth/tiktok/exchange.js
// Vercel serverless (Node 18+). Drop into /api/auth/tiktok/exchange.js
export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return res.status(405).json({ error: "method_not_allowed" });
    }

    // Accept either JSON body or urlencoded — frontend sends JSON in your case
    const { code, code_verifier, redirect_uri } = req.body || {};

    if (!code) {
      return res.status(400).json({ error: "missing_code" });
    }

    // read server-side secrets (must be set in Vercel dashboard as env vars)
    const CLIENT_KEY = process.env.TIKTOK_CLIENT_KEY || process.env.VITE_TIKTOK_CLIENT_KEY;
    const CLIENT_SECRET = process.env.TIKTOK_CLIENT_SECRET || process.env.TIKTOK_CLIENT_SECRET;

    // Defensive: ensure we fail with clear message rather than crash (this logs server-side)
    if (!CLIENT_KEY || !CLIENT_SECRET) {
      console.error("Missing CLIENT_KEY or CLIENT_SECRET in server environment");
      return res.status(500).json({ error: "server_misconfigured", detail: "Missing TikTok client key/secret" });
    }

    // Build form body per TikTok docs (application/x-www-form-urlencoded)
    const params = new URLSearchParams();
    params.append("client_key", CLIENT_KEY);
    params.append("client_secret", CLIENT_SECRET);
    params.append("code", code);
    params.append("grant_type", "authorization_code");
    if (redirect_uri) params.append("redirect_uri", redirect_uri);
    if (code_verifier) params.append("code_verifier", code_verifier); // harmless if present

    const tokenUrl = "https://open.tiktokapis.com/v2/oauth/token/"; // docs show trailing slash
    const tokenRes = await fetch(tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Cache-Control": "no-cache",
      },
      body: params.toString(),
    });

    const raw = await tokenRes.text();
    let tokenData;
    try {
      tokenData = JSON.parse(raw);
    } catch (e) {
      console.error("TikTok token response not JSON:", raw);
      return res.status(502).json({ error: "invalid_vendor_response", detail: raw.slice(0, 2000) });
    }

    if (!tokenRes.ok) {
      console.error("TikTok token endpoint error:", tokenRes.status, tokenData);
      return res.status(502).json({ error: "token_exchange_failed", status: tokenRes.status, detail: tokenData });
    }

    // tokenData now contains access_token, refresh_token, open_id, expires_in, etc.
    // Optionally fetch basic user profile to return to the client
    let profile = null;
    try {
      if (tokenData.access_token) {
        const userInfoUrl = "https://open.tiktokapis.com/v2/user/info/";
        const uiRes = await fetch(userInfoUrl, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${tokenData.access_token}`,
            "Content-Type": "application/json",
          },
        });
        const uiRaw = await uiRes.text();
        try {
          const uiJson = JSON.parse(uiRaw);
          if (uiRes.ok) profile = uiJson;
          else console.warn("User info fetch returned non-ok:", uiRes.status, uiJson);
        } catch (e) {
          console.warn("User info non-JSON:", uiRaw);
        }
      }
    } catch (err) {
      console.warn("Failed fetching user info:", err);
    }

    // Persist server-side as needed (store refresh_token securely), and return minimal object
    return res.status(200).json({
      tokens: tokenData,
      profile,
      message: "token_exchange_successful",
    });
  } catch (err) {
    console.error("Unhandled exception in /api/auth/tiktok/exchange:", err);
    return res.status(500).json({ error: "internal_server_error", message: String(err) });
  }
}
