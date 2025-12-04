// server/api/auth/tiktok/exchange.js
// Serverless handler (Vercel / Netlify style). Returns tokens + normalized profile when possible.

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return res.status(405).json({ error: "method_not_allowed" });
    }

    const { code, code_verifier, redirect_uri } = req.body || {};
    if (!code) return res.status(400).json({ error: "missing_code" });

    const CLIENT_KEY = process.env.TIKTOK_CLIENT_KEY || process.env.VITE_TIKTOK_CLIENT_KEY;
    const CLIENT_SECRET = process.env.TIKTOK_CLIENT_SECRET || process.env.TIKTOK_CLIENT_SECRET;
    if (!CLIENT_KEY || !CLIENT_SECRET) {
      console.error("Missing CLIENT_KEY or CLIENT_SECRET in server environment");
      return res.status(500).json({ error: "server_misconfigured", detail: "Missing TikTok client key/secret" });
    }

    // exchange code -> tokens
    const params = new URLSearchParams();
    params.append("client_key", CLIENT_KEY);
    params.append("client_secret", CLIENT_SECRET);
    params.append("code", code);
    params.append("grant_type", "authorization_code");
    if (redirect_uri) params.append("redirect_uri", redirect_uri);
    if (code_verifier) params.append("code_verifier", code_verifier);

    const tokenUrl = process.env.TIKTOK_TOKEN_URL || "https://open.tiktokapis.com/v2/oauth/token/";
    const tokenRes = await fetch(tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", "Cache-Control": "no-cache" },
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

    // Optionally fetch user info (best-effort)
    let profile = null;
    try {
      // Build userinfo URL and try both header and query param approaches
      const userInfoBase = process.env.TIKTOK_USERINFO_URL || "https://open.tiktokapis.com/v2/user/info/";

      // Prefer header Authorization if access_token is present
      const accessToken = tokenData.access_token || tokenData.data?.access_token || null;
      const openId = tokenData.open_id || tokenData.data?.open_id || tokenData.openid || null;

      // Try: Authorization: Bearer <token>
      let uiRes = null;
      try {
        uiRes = await fetch(userInfoBase, {
          method: "GET",
          headers: accessToken ? { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" } : { "Content-Type": "application/json" },
        });
      } catch (err) {
        // Try fallback: query params style
        const url = new URL(userInfoBase);
        if (accessToken) url.searchParams.set("access_token", accessToken);
        if (openId) url.searchParams.set("open_id", openId);
        uiRes = await fetch(url.toString(), { method: "GET" });
      }

      const uiRaw = await uiRes.text();
      let uiJson;
      try {
        uiJson = JSON.parse(uiRaw);
      } catch (e) {
        console.warn("User info non-JSON:", uiRaw);
        uiJson = null;
      }

      if (!uiRes.ok) {
        console.warn("User info fetch non-ok:", uiRes.status, uiJson);
      } else if (uiJson) {
        // Normalize: uiJson may contain { data: { user: {...} } } or { data: {...} } or { user: {...} }
        const userObj =
          (uiJson && (uiJson.data || uiJson.user || uiJson.data === null))
            ? (uiJson.data?.user || uiJson.user || uiJson.data)
            : uiJson || {};

        const normalizedOpenId =
          tokenData.open_id ||
          tokenData.data?.open_id ||
          userObj.open_id ||
          userObj.openId ||
          userObj.id ||
          userObj.openid ||
          null;

        const display_name =
          userObj.display_name || userObj.nickname || userObj.unique_id || userObj.displayName || userObj.name || null;

        const avatar =
          userObj.avatar || userObj.avatar_large || userObj.avatar_url || userObj.avatarUrl || null;

        profile = {
          raw: uiJson,
          open_id: normalizedOpenId,
          display_name,
          avatar,
        };
      }
    } catch (err) {
      console.warn("Failed fetching user info:", err && (err.body || err.message || err));
    }

    // Return tokens and normalized profile
    return res.status(200).json({
      tokens: tokenData,
      profile,
      message: "token_exchange_successful",
    });
  } catch (err) {
    console.error("Unhandled exception in /api/auth/tiktok/exchange:", err && (err.stack || err));
    return res.status(500).json({ error: "internal_server_error", message: String(err) });
  }
}
