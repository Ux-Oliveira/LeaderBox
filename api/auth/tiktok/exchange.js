// /api/auth/tiktok/exchange.js
import fetch from "node-fetch";

const PRIMARY_TOKEN_URL = process.env.TIKTOK_TOKEN_URL || "https://open.tiktokapis.com/v2/oauth/token";
const FALLBACK_TOKEN_URL = process.env.TIKTOK_FALLBACK_TOKEN_URL || "https://open-api.tiktok.com/oauth/access_token";
const USERINFO_URL = process.env.TIKTOK_USERINFO_URL || "https://open.tiktokapis.com/v2/user/info/";

function safeJSONParse(text) {
  try {
    return { ok: true, json: JSON.parse(text) };
  } catch (e) {
    return { ok: false, raw: text };
  }
}

async function doTokenRequest(url, paramsString, headers) {
  const resp = await fetch(url, {
    method: "POST",
    headers,
    body: paramsString,
  });
  const text = await resp.text();
  return { resp, text };
}

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

    // Build form body
    const tokenParams = new URLSearchParams();
    tokenParams.append("client_key", CLIENT_KEY);
    tokenParams.append("client_secret", CLIENT_SECRET);
    tokenParams.append("grant_type", "authorization_code");
    tokenParams.append("code", code);
    tokenParams.append("redirect_uri", REDIRECT_URI);
    tokenParams.append("code_verifier", code_verifier);

    const headers = { "Content-Type": "application/x-www-form-urlencoded" };

    // Primary attempt
    const primary = await doTokenRequest(PRIMARY_TOKEN_URL, tokenParams.toString(), headers);
    console.log("[TikTok EXCHANGE] primary url:", PRIMARY_TOKEN_URL, "status:", primary.resp.status);
    console.log("[TikTok EXCHANGE] primary body (first 1000 chars):", String(primary.text).slice(0, 1000));

    let parsed = safeJSONParse(primary.text);
    if (!parsed.ok) {
      // Primary returned non-JSON. Return debug payload but also attempt fallback automatically
      console.warn("[TikTok EXCHANGE] primary returned non-JSON. Trying fallback token URL:", FALLBACK_TOKEN_URL);

      // Try fallback
      const fallback = await doTokenRequest(FALLBACK_TOKEN_URL, tokenParams.toString(), headers);
      console.log("[TikTok EXCHANGE] fallback url:", FALLBACK_TOKEN_URL, "status:", fallback.resp.status);
      console.log("[TikTok EXCHANGE] fallback body (first 1000 chars):", String(fallback.text).slice(0, 1000));

      const fbParsed = safeJSONParse(fallback.text);

      if (!fbParsed.ok) {
        // Both returned non-JSON — return both raw bodies for debugging
        return res.status(502).json({
          error: "Both primary and fallback token endpoints returned non-JSON",
          primary: { status: primary.resp.status, raw: primary.text },
          fallback: { status: fallback.resp.status, raw: fallback.text },
          debug_hint:
            "Check redirect URI exactness and credentials. Paste the 'raw' text here if you need help interpreting the error HTML/text.",
        });
      }

      // Fallback returned JSON, use it
      parsed = fbParsed;
    }

    const tokenJson = parsed.json;
    if (!tokenJson || !tokenJson.access_token) {
      // Token endpoint returned JSON but no access_token
      return res.status(502).json({
        error: "Token endpoint returned JSON but no access_token field",
        tokenResponse: tokenJson,
        debug_hint: "Look for open_id or error fields in tokenResponse",
      });
    }

    // We have tokens — fetch user info server-side
    const accessToken = tokenJson.access_token || tokenJson.data?.access_token;
    const openId = tokenJson.open_id || tokenJson.data?.open_id || tokenJson.openid || null;

    if (!accessToken) {
      return res.status(502).json({
        error: "No access_token present after parsing token JSON (unexpected)",
        tokenResponse: tokenJson,
      });
    }

    // Build user info URL
    const userUrl = new URL(USERINFO_URL);
    userUrl.searchParams.set("access_token", accessToken);
    if (openId) userUrl.searchParams.set("open_id", openId);

    let profileJson = null;
    try {
      const userResp = await fetch(userUrl.toString(), { method: "GET" });
      const userText = await userResp.text();
      console.log("[TikTok USERINFO] status:", userResp.status, "body (first 1000 chars):", String(userText).slice(0, 1000));
      const userParsed = safeJSONParse(userText);
      if (!userParsed.ok) {
        return res.status(200).json({
          tokens: tokenJson,
          profile: null,
          userinfo_error: { status: userResp.status, raw: userText },
          redirectUrl: "/",
        });
      }
      profileJson = userParsed.json;
      if (!userResp.ok) {
        return res.status(200).json({
          tokens: tokenJson,
          profile: null,
          userinfo_error: { status: userResp.status, body: profileJson },
          redirectUrl: "/",
        });
      }
    } catch (err) {
      console.error("[TikTok USERINFO] fetch error:", err);
      return res.status(200).json({
        tokens: tokenJson,
        profile: null,
        userinfo_error: String(err),
        redirectUrl: "/",
      });
    }

    // SUCCESS
    return res.status(200).json({
      tokens: tokenJson,
      profile: profileJson,
      redirectUrl: "/",
      debug: {
        primary_token_url: PRIMARY_TOKEN_URL,
        fallback_token_url: FALLBACK_TOKEN_URL,
      },
    });
  } catch (err) {
    console.error("Exchange handler exception:", err);
    return res.status(500).json({ error: "Internal server error", details: String(err) });
  }
}
