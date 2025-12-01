// /api/auth/tiktok/exchange.js
import fetch from "node-fetch";

/**
 * Serverless handler: exchanges TikTok OAuth code for tokens then fetches user profile.
 * Expects POST JSON body: { code, code_verifier, redirect_uri }
 *
 * Environment variables required:
 * - VITE_TIKTOK_CLIENT_KEY (client_key)
 * - TIKTOK_CLIENT_SECRET
 * - VITE_TIKTOK_REDIRECT_URI (fallback redirect uri)
 * - TIKTOK_TOKEN_URL (optional; default: https://open.tiktokapis.com/v2/oauth/token)
 * - TIKTOK_USERINFO_URL (optional; default: https://open.tiktokapis.com/v2/user/info/)
 */
const TOKEN_URL = process.env.TIKTOK_TOKEN_URL || "https://open.tiktokapis.com/v2/oauth/token";
const USERINFO_URL = process.env.TIKTOK_USERINFO_URL || "https://open.tiktokapis.com/v2/user/info/";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed, use POST" });
  }

  try {
    const { code, code_verifier, redirect_uri } = req.body || {};

    if (!code || !code_verifier) {
      return res.status(400).json({ error: "Missing code or code_verifier in request body" });
    }

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
    let tokenJson;
    try {
      tokenJson = JSON.parse(tokenText);
    } catch (err) {
      console.error("TikTok token exchange returned non-JSON:", tokenText);
      return res.status(502).json({ error: "TikTok returned non-JSON on token exchange", raw: tokenText });
    }

    if (!tokenResp.ok || !tokenJson.access_token) {
      console.error("TikTok token exchange failed:", tokenJson);
      return res.status(tokenResp.status || 502).json({
        error: "TikTok token exchange failed",
        status: tokenResp.status,
        body: tokenJson,
      });
    }

    // 2) Fetch user info server-side to avoid CORS + ensure correct auth
    // Try to use access_token and open_id if present
    const accessToken = tokenJson.access_token || tokenJson.data?.access_token;
    const openId = tokenJson.open_id || tokenJson.data?.open_id || tokenJson.openid || null;

    if (!accessToken) {
      // Shouldn't happen because we checked access_token above, but guard anyway
      return res.status(502).json({ error: "No access_token present in token response", tokens: tokenJson });
    }

    // Build user-info URL with query params (TikTok v2 commonly accepts access_token + open_id)
    const userUrl = new URL(USERINFO_URL);
    userUrl.searchParams.set("access_token", accessToken);
    if (openId) userUrl.searchParams.set("open_id", openId);

    let profileJson = null;
    try {
      const userResp = await fetch(userUrl.toString(), { method: "GET" });
      const userText = await userResp.text();
      try {
        profileJson = JSON.parse(userText);
      } catch (err) {
        console.warn("TikTok userinfo returned non-JSON:", userText);
        // Keep profileJson null and return debug info below
        profileJson = null;
      }
      if (!userResp.ok) {
        console.warn("TikTok userinfo fetch not ok:", userResp.status, profileJson);
        // We'll still return tokens but include userinfo error details
        return res.status(200).json({
          tokens: tokenJson,
          profile: null,
          userinfo_error: { status: userResp.status, body: profileJson || userText },
          redirectUrl: "/",
        });
      }
    } catch (err) {
      console.error("Error fetching TikTok userinfo:", err);
      return res.status(200).json({
        tokens: tokenJson,
        profile: null,
        userinfo_error: String(err),
        redirectUrl: "/",
      });
    }

    // Success: return tokens and profile
    return res.status(200).json({
      tokens: tokenJson,
      profile: profileJson,
      redirectUrl: "/",
    });

  } catch (err) {
    console.error("Exchange handler exception:", err);
    return res.status(500).json({ error: "Internal server error", details: String(err) });
  }
}
