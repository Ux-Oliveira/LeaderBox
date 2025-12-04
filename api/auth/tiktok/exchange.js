// server/api/auth/tiktok/exchange.js
// Uses server/tiktok.js helpers (exchangeTikTokCode, fetchTikTokUserInfo)

import { exchangeTikTokCode, fetchTikTokUserInfo } from "../../tiktok.js";

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return res.status(405).json({ error: "method_not_allowed" });
    }

    const { code, code_verifier, redirect_uri } = req.body || {};
    if (!code || !code_verifier) return res.status(400).json({ error: "missing_code_or_code_verifier" });

    let tokenJson;
    try {
      tokenJson = await exchangeTikTokCode({ code, code_verifier, redirect_uri });
    } catch (err) {
      console.error("Token exchange failed:", err && (err.body || err.raw || err.message));
      return res.status(502).json({ error: "token_exchange_failed", details: err && (err.body || err.raw || err.message) });
    }

    let profile = null;
    try {
      profile = await fetchTikTokUserInfo(tokenJson);
      if (profile) {
        // ensure fields present
        profile.open_id = profile.open_id || profile.raw?.data?.user?.open_id || profile.raw?.open_id || null;
        profile.display_name = profile.display_name || profile.raw?.data?.user?.display_name || profile.raw?.display_name || null;
        profile.avatar = profile.avatar || profile.raw?.data?.user?.avatar || profile.raw?.avatar || null;
      }
    } catch (err) {
      console.warn("User info fetch failed (best-effort):", err && (err.body || err.message));
      profile = profile || null;
    }

    return res.status(200).json({ tokens: tokenJson, profile, redirectUrl: "/" });
  } catch (err) {
    console.error("Unhandled error in serverless exchange:", err && (err.stack || err));
    return res.status(500).json({ error: "internal_server_error", message: String(err) });
  }
}
