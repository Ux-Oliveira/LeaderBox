// /api/auth/tiktok/exchange.js
import fetch from "node-fetch";

const TOKEN_URL = process.env.TIKTOK_TOKEN_URL || "https://open.tiktokapis.com/v2/oauth/token";
const USERINFO_URL = process.env.TIKTOK_USERINFO_URL || "https://open.tiktokapis.com/v2/user/info/";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed, use POST" });
  }

  try {
    const { code, code_verifier, redirect_uri } = req.body || {};
    if (!code || !code_verifier) return res.status(400).json({ error: "Missing code or code_verifier" });

    const CLIENT_KEY = process.env.VITE_TIKTOK_CLIENT_KEY || process.env.TIKTOK_CLIENT_KEY;
    const CLIENT_SECRET = process.env.TIKTOK_CLIENT_SECRET;
    const REDIRECT_URI = redirect_uri || process.env.VITE_TIKTOK_REDIRECT_URI || process.env.TIKTOK_REDIRECT_URI;

    if (!CLIENT_KEY || !CLIENT_SECRET) {
      return res.status(500).json({ error: "Server missing TikTok credentials (VITE_TIKTOK_CLIENT_KEY / TIKTOK_CLIENT_SECRET)" });
    }
    if (!REDIRECT_URI) {
      return res.status(500).json({ error: "Server missing redirect URI (VITE_TIKTOK_REDIRECT_URI)" });
    }

    // 1) Exchange code -> tokens
    const tokenParams = new URLSearchParams();
    tokenParams.append("client_key", CLIENT_KEY);
    tokenParams.append("client_secret", CLIENT_SECRET);
    tokenParams.append("grant_type", "authorization_code");
    tokenParams.append("code", code);
    tokenParams.append("redirect_uri", REDIRECT_URI);
    tokenParams.append("code_verifier", code_verifier);

    const tokenResp = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: tokenParams.toString(),
    });

    const tokenText = await tokenResp.text();

    // Try parse JSON; if not JSON, return helpful debug info
    let tokenJson = null;
    try {
      tokenJson = JSON.parse(tokenText);
    } catch (err) {
      console.error("TikTok token exchange returned non-JSON:", tokenText);
      // Return raw response for debugging on the client
      return res.status(502).json({
        error: "TikTok token exchange returned non-JSON",
        status: tokenResp.status,
        raw: tokenText,
        debug_hint: "Check TIKTOK_TOKEN_URL, client_key, client_secret, redirect_uri; TikTok may have returned an HTML error page."
      });
    }

    if (!tokenResp.ok || !tokenJson.access_token) {
      console.error("TikTok token exchange failed (json):", tokenJson);
      return res.status(tokenResp.status || 502).json({
        error: "TikTok token exchange failed",
        status: tokenResp.status,
        body: tokenJson
      });
    }

    // 2) Fetch user info server-side (avoid CORS)
    const accessToken = tokenJson.access_token || tokenJson.data?.access_token;
    const openId = tokenJson.open_id || tokenJson.data?.open_id || tokenJson.openid || null;

    if (!accessToken) {
      return res.status(502).json({ error: "No access_token present in token response", tokens: tokenJson });
    }

    const userUrl = new URL(USERINFO_URL);
    userUrl.searchParams.set("access_token", accessToken);
    if (openId) userUrl.searchParams.set("open_id", openId);

    let profileJson = null;
    try {
      const userResp = await fetch(userUrl.toString(), { method: "GET" });
      const userText = await userResp.text();
      try {
        profileJson = JSON.parse(userText);
      } catch (e) {
        console.warn("TikTok userinfo returned non-JSON:", userText);
        // return tokens with debug info
        return res.status(200).json({
          tokens: tokenJson,
          profile: null,
          userinfo_error: { status: userResp.status, raw: userText },
          redirectUrl: "/"
        });
      }

      if (!userResp.ok) {
        console.warn("TikTok userinfo fetch failed:", userResp.status, profileJson);
        return res.status(200).json({
          tokens: tokenJson,
          profile: null,
          userinfo_error: { status: userResp.status, body: profileJson },
          redirectUrl: "/"
        });
      }
    } catch (err) {
      console.error("Error fetching TikTok userinfo:", err);
      return res.status(200).json({
        tokens: tokenJson,
        profile: null,
        userinfo_error: String(err),
        redirectUrl: "/"
      });
    }

    // Success
    return res.status(200).json({
      tokens: tokenJson,
      profile: profileJson,
      redirectUrl: "/"
    });

  } catch (err) {
    console.error("Exchange handler exception:", err);
    return res.status(500).json({ error: "Internal server error", details: String(err) });
  }
}
