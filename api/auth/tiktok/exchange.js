// /api/auth/tiktok/exchange.js  (diagnostic version)
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
    console.log("[EXCHANGE] env snapshot:", { CLIENT_KEY_PRESENT, CLIENT_SECRET_PRESENT, REDIRECT_ENV, PRIMARY_TOKEN_URL, FALLBACK_TOKEN_URL });

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
    console.log("[EXCHANGE] primary status:", primary.resp.status);
    console.log("[EXCHANGE] primary body (first 1200 chars):", String(primary.text).slice(0, 1200));

    const primaryParsed = safeJSONParse(primary.text);
    if (!primaryParsed.ok) {
      // Return the primary raw body so you can inspect HTML/error message.
      // Also attempt fallback automatically so we gather more data.
      const fallback = await doTokenRequest(FALLBACK_TOKEN_URL, tokenParams.toString(), headers);
      console.log("[EXCHANGE] fallback status:", fallback.resp.status);
      console.log("[EXCHANGE] fallback body (first 1200 chars):", String(fallback.text).slice(0, 1200));

      const fallbackParsed = safeJSONParse(fallback.text);

      return res.status(502).json({
        error: "Token endpoints returned non-JSON (see raw) — usually redirect_uri or credentials issue",
        primary: { status: primary.resp.status, raw: primary.text },
        fallback: { status: fallback.resp.status, raw: fallback.text },
        env_snapshot: { CLIENT_KEY_PRESENT, CLIENT_SECRET_PRESENT, REDIRECT_ENV },
        debug_hint: "Paste the 'primary.raw' value here (or its first ~2000 chars) and I will parse it.",
      });
    }

    // Primary returned JSON — inspect fields
    const tokenJson = primaryParsed.json;
    if (!tokenJson.access_token) {
      console.log("[EXCHANGE] token JSON missing access_token:", tokenJson);
      return res.status(502).json({
        error: "Token JSON returned but missing access_token",
        tokenJson,
        env_snapshot: { CLIENT_KEY_PRESENT, CLIENT_SECRET_PRESENT, REDIRECT_ENV },
      });
    }

    // Success: fetch user info server-side (best-effort)
    const accessToken = tokenJson.access_token || tokenJson.data?.access_token;
    const openId = tokenJson.open_id || tokenJson.data?.open_id || tokenJson.openid || null;

    const userUrl = new URL(USERINFO_URL);
    userUrl.searchParams.set("access_token", accessToken);
    if (openId) userUrl.searchParams.set("open_id", openId);

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

    return res.status(200).json({
      tokens: tokenJson,
      profile: userParsed.json,
      env_snapshot: { CLIENT_KEY_PRESENT, CLIENT_SECRET_PRESENT, REDIRECT_ENV },
    });

  } catch (err) {
    console.error("[EXCHANGE] exception:", err);
    return res.status(500).json({ error: "Internal server error", details: String(err) });
  }
}
