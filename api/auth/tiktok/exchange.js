// server/api/auth/tiktok/exchange.js
// Serverless-style handler (Vercel / Netlify friendly).
// Tries to import server/tiktok.js helpers; falls back to inline exchange + userinfo logic.
// Returns { tokens, profile, redirectUrl }

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return res.status(405).json({ error: "method_not_allowed" });
    }

    const { code, code_verifier, redirect_uri } = req.body || {};
    if (!code || !code_verifier) return res.status(400).json({ error: "missing_code_or_code_verifier" });

    // Try to import your central helpers if available (server/tiktok.js).
    let exchangeTikTokCode = null;
    let fetchTikTokUserInfo = null;
    try {
      // dynamic import so file works in multiple deploy shapes
      // adjust path if your project layout differs
      const mod = await import("../../tiktok.js").catch(() => null);
      if (mod) {
        exchangeTikTokCode = mod.exchangeTikTokCode || mod.default?.exchangeTikTokCode || null;
        fetchTikTokUserInfo = mod.fetchTikTokUserInfo || mod.default?.fetchTikTokUserInfo || null;
      }
    } catch (e) {
      // ignore — will use fallback
    }

    // Fallback exchange implementation if helper not present
    async function fallbackExchange({ code, code_verifier, redirect_uri }) {
      const CLIENT_KEY = process.env.TIKTOK_CLIENT_KEY || process.env.VITE_TIKTOK_CLIENT_KEY;
      const CLIENT_SECRET = process.env.TIKTOK_CLIENT_SECRET || process.env.VITE_TIKTOK_CLIENT_SECRET || process.env.TIKTOK_CLIENT_SECRET;
      const TIKTOK_TOKEN_URL = process.env.TIKTOK_TOKEN_URL || "https://open.tiktokapis.com/v2/oauth/token/";

      if (!CLIENT_KEY || !CLIENT_SECRET) {
        throw new Error("TikTok client credentials missing (env TIKTOK_CLIENT_SECRET / VITE_TIKTOK_CLIENT_KEY)");
      }

      const params = new URLSearchParams();
      params.append("client_key", CLIENT_KEY);
      params.append("client_secret", CLIENT_SECRET);
      params.append("code", code);
      params.append("grant_type", "authorization_code");
      if (redirect_uri) params.append("redirect_uri", redirect_uri);
      if (code_verifier) params.append("code_verifier", code_verifier);

      const tokenRes = await fetch(TIKTOK_TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", "Cache-Control": "no-cache" },
        body: params.toString(),
      });

      const raw = await tokenRes.text();
      let tokenData;
      try {
        tokenData = raw ? JSON.parse(raw) : {};
      } catch (e) {
        const err = new Error("TikTok token response not JSON");
        err.raw = raw;
        throw err;
      }

      if (!tokenRes.ok) {
        const err = new Error("TikTok token endpoint returned non-ok");
        err.status = tokenRes.status;
        err.body = tokenData;
        throw err;
      }

      // ensure access_token exists
      const accessToken = tokenData.access_token || tokenData.data?.access_token;
      if (!accessToken) {
        const err = new Error("No access_token returned from TikTok token exchange");
        err.body = tokenData;
        throw err;
      }

      return tokenData;
    }

    // Fallback userinfo fetch if helper not present
    async function fallbackFetchUserInfo(tokenData) {
      const TIKTOK_USERINFO_URL = process.env.TIKTOK_USERINFO_URL || "https://open.tiktokapis.com/v2/user/info/";
      const accessToken = tokenData.access_token || tokenData.data?.access_token || null;
      const openId = tokenData.open_id || tokenData.data?.open_id || tokenData.openid || null;

      // first try header method:
      try {
        const headerResp = await fetch(TIKTOK_USERINFO_URL, {
          method: "GET",
          headers: accessToken ? { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" } : { "Content-Type": "application/json" },
        });
        const txt = await headerResp.text();
        let json = null;
        try { json = txt ? JSON.parse(txt) : {}; } catch (e) { json = null; }
        if (headerResp.ok && json) {
          const u = normalizeUserJson(json, tokenData);
          return u;
        }
      } catch (e) {
        // continue to query-param approach
      }

      // try query param approach
      try {
        const u = new URL(TIKTOK_USERINFO_URL);
        if (accessToken) u.searchParams.set("access_token", accessToken);
        if (openId) u.searchParams.set("open_id", openId);
        const r = await fetch(u.toString(), { method: "GET" });
        const txt = await r.text();
        let json = null;
        try { json = txt ? JSON.parse(txt) : {}; } catch (e) { json = null; }
        if (r.ok && json) {
          return normalizeUserJson(json, tokenData);
        }
      } catch (e) {
        // give up — return what we can
      }

      // final fallback: return null profile but include tokenData
      return null;
    }

    // small helper to normalize varied TikTok user shapes
    function normalizeUserJson(json, tokenData = {}) {
      if (!json) return null;

      // possible shapes:
      // { data: { user: { ... } } } OR { data: { ... } } OR { user: { ... } } OR top-level fields
      const candidate = (json.data && (json.data.user || json.data)) || json.user || json || {};
      const open_id =
        candidate.open_id ||
        candidate.openId ||
        candidate.openid ||
        tokenData.open_id ||
        tokenData.data?.open_id ||
        null;

      const display_name =
        candidate.display_name ||
        candidate.nickname ||
        candidate.unique_id ||
        candidate.displayName ||
        candidate.name ||
        candidate.username ||
        null;

      const avatar =
        candidate.avatar ||
        candidate.avatar_large ||
        candidate.avatar_url ||
        candidate.avatarUrl ||
        candidate.profile_image_url ||
        null;

      // attach raw for debugging
      return { raw: json, open_id: open_id || null, display_name: display_name || null, avatar: avatar || null };
    }

    // 1) Do token exchange (use helper if available)
    let tokenJson;
    try {
      if (exchangeTikTokCode) {
        tokenJson = await exchangeTikTokCode({ code, code_verifier, redirect_uri });
      } else {
        tokenJson = await fallbackExchange({ code, code_verifier, redirect_uri });
      }
    } catch (err) {
      console.error("Token exchange failed:", err && (err.body || err.message || err));
      // If err has body, include it for debugging
      return res.status(502).json({ error: "token_exchange_failed", details: err && err.body ? err.body : String(err) });
    }

    // 2) Try fetch user info (best-effort)
    let profile = null;
    try {
      if (fetchTikTokUserInfo) {
        profile = await fetchTikTokUserInfo(tokenJson);
        // ensure normalized fields
        if (profile) {
          profile.open_id = profile.open_id || profile.raw?.data?.user?.open_id || profile.raw?.open_id || profile.open_id || null;
          profile.display_name = profile.display_name || profile.raw?.data?.user?.display_name || profile.raw?.display_name || profile.display_name || null;
          profile.avatar = profile.avatar || profile.raw?.data?.user?.avatar || profile.raw?.avatar || profile.avatar || null;
        }
      } else {
        profile = await fallbackFetchUserInfo(tokenJson);
      }
    } catch (err) {
      console.warn("User info fetch failed (non-fatal):", err && (err.body || err.message || err));
      profile = profile || null;
    }

    // 3) Return tokens + profile
    const result = {
      tokens: tokenJson,
      profile: profile || null,
      redirectUrl: "/",
    };

    return res.status(200).json(result);
  } catch (err) {
    console.error("Unhandled exception in /api/auth/tiktok/exchange:", err && (err.stack || err));
    return res.status(500).json({ error: "internal_server_error", message: String(err) });
  }
}
