// api/auth/tiktok/exchange.js
// Robust TikTok token exchange with automatic payload-variant retries and clear debug output.

async function parseBody(req) {
  if (req.body && Object.keys(req.body).length) return req.body;
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

function buildForm(params) {
  const p = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null) p.append(k, String(v));
  });
  return p.toString();
}

async function callToken(url, bodyString) {
  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: bodyString,
  });
  const text = await resp.text();
  let json = null;
  try { json = JSON.parse(text); } catch (e) { /* non-json */ }
  return { ok: resp.ok, status: resp.status, json, raw: text };
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

    // env fallbacks
    const CLIENT_KEY = process.env.VITE_TIKTOK_CLIENT_KEY || process.env.TIKTOK_CLIENT_KEY || null;
    const CLIENT_SECRET = process.env.TIKTOK_CLIENT_SECRET || null;
    const REDIRECT_URI = redirect_uri || process.env.VITE_TIKTOK_REDIRECT_URI || process.env.TIKTOK_REDIRECT_URI || null;
    const TOKEN_URL = process.env.TIKTOK_TOKEN_URL || "https://open.tiktokapis.com/v2/oauth/token";
    const ALT_TOKEN_URL = "https://open-api.tiktok.com/oauth/access_token";
    const USERINFO_URL = process.env.TIKTOK_USERINFO_URL || "https://open.tiktokapis.com/v2/user/info/";

    if (!CLIENT_KEY && !process.env.TIKTOK_CLIENT_KEY) {
      return res.status(500).json({ error: "Server missing client key env (VITE_TIKTOK_CLIENT_KEY or TIKTOK_CLIENT_KEY)" });
    }
    if (!CLIENT_SECRET) {
      // OK — some flows omit client_secret; handler will try variants without it
      console.warn("No TIKTOK_CLIENT_SECRET in env; handler will attempt PKCE public-client variants.");
    }
    if (!REDIRECT_URI) {
      return res.status(500).json({ error: "Server missing redirect URI (set VITE_TIKTOK_REDIRECT_URI or send redirect_uri in payload)" });
    }

    const tokenUrlsToTry = Array.from(new Set([TOKEN_URL, ALT_TOKEN_URL])); // try both
    const attempts = [];

    // variants to try (ordered). Each entry describes the form fields to send.
    const variants = [
      { name: "A_client_key+client_secret+code_verifier", params: { client_key: CLIENT_KEY, client_secret: CLIENT_SECRET, grant_type: "authorization_code", code, redirect_uri: REDIRECT_URI, code_verifier } },
      { name: "B_client_key+code_verifier (PKCE no secret)", params: { client_key: CLIENT_KEY, grant_type: "authorization_code", code, redirect_uri: REDIRECT_URI, code_verifier } },
      { name: "C_client_id+client_secret+code_verifier", params: { client_id: CLIENT_KEY, client_secret: CLIENT_SECRET, grant_type: "authorization_code", code, redirect_uri: REDIRECT_URI, code_verifier } },
      { name: "D_client_id+client_secret (confidential no pkce)", params: { client_id: CLIENT_KEY, client_secret: CLIENT_SECRET, grant_type: "authorization_code", code, redirect_uri: REDIRECT_URI } }
    ];

    let successful = null;
    let finalTokenJson = null;
    let finalProfile = null;

    // Iterate token URLs and variants
    for (const url of tokenUrlsToTry) {
      for (const variant of variants) {
        // skip variants that require client_secret if none present
        if (!CLIENT_SECRET && variant.params.client_secret) {
          attempts.push({ url, variant: variant.name, skipped_reason: "missing client_secret in env" });
          continue;
        }

        const bodyString = buildForm(variant.params);
        let tokenResult;
        try {
          tokenResult = await callToken(url, bodyString);
        } catch (callErr) {
          attempts.push({ url, variant: variant.name, error: String(callErr) });
          continue;
        }

        attempts.push({
          url,
          variant: variant.name,
          status: tokenResult.status,
          ok: tokenResult.ok,
          rawSnippet: tokenResult.raw?.slice?.(0, 120),
          jsonBody: tokenResult.json ? (typeof tokenResult.json === "object" ? tokenResult.json : null) : null
        });

        // success criteria: JSON with access_token
        if (tokenResult.json && (tokenResult.json.access_token || tokenResult.json.data?.access_token)) {
          successful = { url, variant: variant.name, status: tokenResult.status };
          finalTokenJson = tokenResult.json;
          break;
        }

        // if endpoint returned a parameter error, keep trying other variants
        // continue loop
      }
      if (successful) break;
    }

    if (!finalTokenJson) {
      // nothing worked — return full attempts for debugging
      return res.status(400).json({
        error: "TikTok token exchange failed",
        reason: "no variant produced an access_token",
        attempts,
        triedUrls: tokenUrlsToTry,
        hint: "If you see 'Parameter error' try changing which parameters you send (client_secret vs not), or set TIKTOK_TOKEN_URL to the endpoint your TikTok app expects."
      });
    }

    // got tokens — normalize access_token & open_id
    const accessToken = finalTokenJson.access_token || finalTokenJson.data?.access_token;
    const openId = finalTokenJson.open_id || finalTokenJson.data?.open_id || finalTokenJson.openid || null;

    // Attempt server-side user info fetch (best-effort)
    try {
      const uUrl = new URL(USERINFO_URL);
      uUrl.searchParams.set("access_token", accessToken);
      if (openId) uUrl.searchParams.set("open_id", openId);
      const uResp = await fetch(uUrl.toString(), { method: "GET" });
      const uText = await uResp.text();
      try {
        finalProfile = JSON.parse(uText);
      } catch (e) {
        finalProfile = { nonJson: uText?.slice?.(0, 1000) || uText };
      }
    } catch (userinfoErr) {
      finalProfile = { error: String(userinfoErr) };
    }

    return res.status(200).json({
      ok: true,
      tokens: finalTokenJson,
      profile: finalProfile,
      successful,
      attempts
    });
  } catch (err) {
    console.error("Exchange handler exception:", err);
    return res.status(500).json({ error: "Internal server error", details: String(err) });
  }
}
