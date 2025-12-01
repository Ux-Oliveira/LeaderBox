// server/api/auth/tiktok/exchange.js
import fetch from "node-fetch";

const PRIMARY_TOKEN_URL = process.env.TIKTOK_TOKEN_URL || "https://open.tiktokapis.com/v2/oauth/token";
const FALLBACK_TOKEN_URL = process.env.TIKTOK_FALLBACK_TOKEN_URL || "https://open-api.tiktok.com/oauth/access_token";
const USERINFO_URL = process.env.TIKTOK_USERINFO_URL || "https://open.tiktokapis.com/v2/user/info/";

function safeJSONParse(text) {
  try { return { ok: true, json: JSON.parse(text) }; }
  catch (e) { return { ok: false, raw: text }; }
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

    // Snapshot envs for debugging (no secrets printed)
    const CLIENT_KEY_PRESENT = !!(process.env.VITE_TIKTOK_CLIENT_KEY || process.env.TIKTOK_CLIENT_KEY);
    const CLIENT_SECRET_PRESENT = !!process.env.TIKTOK_CLIENT_SECRET;
    const REDIRECT_ENV = process.env.VITE_TIKTOK_REDIRECT_URI || process.env.TIKTOK_REDIRECT_URI || null;

    const CLIENT_KEY = process.env.VITE_TIKTOK_CLIENT_KEY || process.env.TIKTOK_CLIENT_KEY;
    const CLIENT_SECRET = process.env.TIKTOK_CLIENT_SECRET;
    const REDIRECT_URI = redirect_uri || REDIRECT_ENV;

    if (!CLIENT_KEY || !CLIENT_SECRET) {
      return res.status(500).json({ error: "Server missing TikTok credentials (VITE_TIKTOK_CLIENT_KEY / TIKTOK_CLIENT_SECRET)" });
    }
    if (!REDIRECT_URI) {
      return res.status(500).json({ error: "Server missing redirect URI (VITE_TIKTOK_REDIRECT_URI or TIKTOK_REDIRECT_URI)" });
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

    // Try primary
    const primary = await doTokenRequest(PRIMARY_TOKEN_URL, tokenParams.toString(), headers);

    const primaryParsed = safeJSONParse(primary.text);
    if (!primaryParsed.ok) {
      // Primary returned non-JSON — attempt fallback and return both raw responses for debugging
      const fallback = await doTokenRequest(FALLBACK_TOKEN_URL, tokenParams.toString(), headers);
      return res.status(502).json({
        error: "Token endpoints returned non-JSON (usually redirect_uri mismatch or provider HTML error)",
        primary: { status: primary.resp.status, raw: primary.text },
        fallback: { status: fallback.resp.status, raw: fallback.text },
        env_snapshot: { CLIENT_KEY_PRESENT, CLIENT_SECRET_PRESENT, REDIRECT_ENV },
        debug_hint: "Paste the 'primary.raw' here (or its first ~2000 chars).",
      });
    }

    // Primary returned JSON — use it
    const tokenJson = primaryParsed.json;
    if (!tokenJson || !tokenJson.access_token) {
      // JSON but missing access_token
      return res.status(502).json({
        error: "Token JSON returned but missing access_token",
        tokenResponse: tokenJson,
        env_snapshot: { CLIENT_KEY_PRESENT, CLIENT_SECRET_PRESENT, REDIRECT_ENV },
      });
    }

    // We have access_token — attempt server-side userinfo fetch
    const accessToken = tokenJson.access_token || tokenJson.data?.access_token;
    const openId = tokenJson.open_id || tokenJson.data?.open_id || tokenJson.openid || null;

    if (!accessToken) {
      return res.status(502).json({ error: "No access_token present in token response", tokenResponse: tokenJson });
    }

    const userUrl = new URL(USERINFO_URL);
    userUrl.searchParams.set("access_token", accessToken);
    if (openId) userUrl.searchParams.set("open_id", openId);

    // Fetch user info (best-effort)
    try {
      const userResp = await fetch(userUrl.toString(), { method: "GET" });
      const userText = await userResp.text();
      const userParsed = safeJSONParse(userText);
      if (!userParsed.ok) {
        return res.status(200).json({
          tokens: tokenJson,
          profile: null,
          userinfo_error: { status: userResp.status, raw: userText },
          env_snapshot: { CLIENT_KEY_PRESENT, CLIENT_SECRET_PRESENT, REDIRECT_ENV },
        });
      }
      if (!userResp.ok) {
        return res.status(200).json({
          tokens: tokenJson,
          profile: null,
          userinfo_error: { status: userResp.status, body: userParsed.json },
          env_snapshot: { CLIENT_KEY_PRESENT, CLIENT_SECRET_PRESENT, REDIRECT_ENV },
        });
      }

      // Success
      return res.status(200).json({
        tokens: tokenJson,
        profile: userParsed.json,
        env_snapshot: { CLIENT_KEY_PRESENT, CLIENT_SECRET_PRESENT, REDIRECT_ENV },
      });

    } catch (err) {
      return res.status(200).json({
        tokens: tokenJson,
        profile: null,
        userinfo_error: String(err),
        env_snapshot: { CLIENT_KEY_PRESENT, CLIENT_SECRET_PRESENT, REDIRECT_ENV },
      });
    }

  } catch (err) {
    console.error("[EXCHANGE] exception:", err);
    return res.status(500).json({ error: "Internal server error", details: String(err) });
  }
}
