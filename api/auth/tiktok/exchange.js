// api/auth/tiktok/exchange.js
// Vercel serverless handler — robustly handles TikTok token endpoint variants
// (uses global fetch, Node 18+ on Vercel)

async function parseBody(req) {
  if (req.body && Object.keys(req.body).length) return req.body;
  // parse raw JSON body (some serverless setups)
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (c) => (data += c));
    req.on("end", () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on("error", reject);
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed, use POST" });
  }

  try {
    const body = await parseBody(req);
    const { code, code_verifier, redirect_uri } = body || {};

    if (!code || !code_verifier) {
      return res.status(400).json({ error: "Missing code or code_verifier in request body" });
    }

    // Allow multiple env var names (be lenient)
    const CLIENT_KEY = process.env.VITE_TIKTOK_CLIENT_KEY || process.env.TIKTOK_CLIENT_KEY || process.env.TIKTOK_CLIENT || null;
    const CLIENT_SECRET = process.env.TIKTOK_CLIENT_SECRET || process.env.VITE_TIKTOK_CLIENT_SECRET || null;
    const DEFAULT_TOKEN_URL = "https://open.tiktokapis.com/v2/oauth/token";
    const ALT_TOKEN_URL = "https://open-api.tiktok.com/oauth/access_token";
    const TOKEN_URL = process.env.TIKTOK_TOKEN_URL || DEFAULT_TOKEN_URL;
    const USERINFO_URL = process.env.TIKTOK_USERINFO_URL || "https://open.tiktokapis.com/v2/user/info/";
    const REDIRECT_URI = redirect_uri || process.env.VITE_TIKTOK_REDIRECT_URI || process.env.TIKTOK_REDIRECT_URI || null;

    if (!CLIENT_KEY || !CLIENT_SECRET) {
      console.error("Missing TikTok credentials. Env presence:", {
        VITE_TIKTOK_CLIENT_KEY: !!process.env.VITE_TIKTOK_CLIENT_KEY,
        TIKTOK_CLIENT_SECRET: !!process.env.TIKTOK_CLIENT_SECRET
      });
      return res.status(500).json({ error: "Server missing TikTok credentials (set VITE_TIKTOK_CLIENT_KEY and TIKTOK_CLIENT_SECRET in env)" });
    }
    if (!REDIRECT_URI) {
      console.error("Missing redirect URI.", { redirect_uri_provided: !!redirect_uri });
      return res.status(500).json({ error: "Server missing redirect URI (set VITE_TIKTOK_REDIRECT_URI in env)" });
    }

    // helper to call token endpoint and normalize response
    async function callTokenEndpoint(urlToCall) {
      const tokenParams = new URLSearchParams();
      tokenParams.append("client_key", CLIENT_KEY);
      tokenParams.append("client_secret", CLIENT_SECRET);
      tokenParams.append("grant_type", "authorization_code");
      tokenParams.append("code", code);
      tokenParams.append("redirect_uri", REDIRECT_URI);
      tokenParams.append("code_verifier", code_verifier);

      console.log("Calling token endpoint:", urlToCall);

      const resp = await fetch(urlToCall, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: tokenParams.toString(),
      });

      const text = await resp.text();
      // try parse JSON
      try {
        const json = JSON.parse(text);
        return { ok: resp.ok, status: resp.status, json, raw: text };
      } catch (e) {
        return { ok: resp.ok, status: resp.status, json: null, raw: text };
      }
    }

    // 1) try configured/default token URL
    let tokenResult = await callTokenEndpoint(TOKEN_URL);

    // 2) If non-JSON OR 404 with "Unsupported path" (Janus), try alternate endpoint
    const needRetry =
      !tokenResult.json &&
      (tokenResult.status === 404 || (tokenResult.raw && tokenResult.raw.includes("Unsupported path")));

    if (needRetry && TOKEN_URL !== ALT_TOKEN_URL) {
      console.warn("Token endpoint returned non-JSON or unsupported path — retrying alternative endpoint:", ALT_TOKEN_URL);
      tokenResult = await callTokenEndpoint(ALT_TOKEN_URL);
    }

    // If still no JSON, return helpful debug to client
    if (!tokenResult.json) {
      console.error("Token exchange returned non-JSON after retry:", tokenResult.status, tokenResult.raw?.slice?.(0, 1000));
      return res.status(502).json({
        error: "TikTok token exchange returned non-JSON",
        status: tokenResult.status,
        raw: tokenResult.raw,
        tried: [TOKEN_URL, ALT_TOKEN_URL].filter(Boolean),
        debug_hint:
          "Check TIKTOK_TOKEN_URL, client_key, client_secret, and that your app's redirect URI in TikTok App settings exactly matches the redirect used here.",
      });
    }

    if (!tokenResult.ok || !tokenResult.json.access_token) {
      console.error("TikTok token exchange failed (json):", tokenResult.status, tokenResult.json);
      return res.status(tokenResult.status || 502).json({
        error: "TikTok token exchange failed",
        status: tokenResult.status,
        body: tokenResult.json,
        tried: [TOKEN_URL, ALT_TOKEN_URL]
      });
    }

    // 3) fetch user profile server-side (best-effort)
    const accessToken = tokenResult.json.access_token || tokenResult.json.data?.access_token;
    const openId = tokenResult.json.open_id || tokenResult.json.data?.open_id || tokenResult.json.openid || null;

    if (!accessToken) {
      console.error("No access_token present in token response", tokenResult.json);
      return res.status(502).json({ error: "No access_token present in token response", tokens: tokenResult.json });
    }

    const userUrl = new URL(USERINFO_URL);
    userUrl.searchParams.set("access_token", accessToken);
    if (openId) userUrl.searchParams.set("open_id", openId);

    try {
      const userResp = await fetch(userUrl.toString(), { method: "GET" });
      const userText = await userResp.text();
      try {
        const userJson = JSON.parse(userText);
        if (!userResp.ok) {
          console.warn("Userinfo fetch failed:", userResp.status, userJson);
          return res.status(200).json({ tokens: tokenResult.json, profile: null, userinfo_error: { status: userResp.status, body: userJson }, redirectUrl: "/" });
        }
        return res.status(200).json({ tokens: tokenResult.json, profile: userJson, redirectUrl: "/" });
      } catch (e) {
        console.warn("Userinfo returned non-JSON:", userText?.slice?.(0, 1000));
        return res.status(200).json({ tokens: tokenResult.json, profile: null, userinfo_error: { status: userResp.status, raw: userText }, redirectUrl: "/" });
      }
    } catch (userinfoErr) {
      console.error("Fetching userinfo error:", String(userinfoErr));
      return res.status(200).json({ tokens: tokenResult.json, profile: null, userinfo_error: String(userinfoErr), redirectUrl: "/" });
    }
  } catch (err) {
    console.error("Exchange handler exception:", err);
    return res.status(500).json({ error: "Internal server error", details: String(err) });
  }
}
