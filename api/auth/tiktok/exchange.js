// api/auth/tiktok/exchange.js
// Vercel serverless handler (Node 18+ runtime assumed).
// IMPORTANT: don't import `dotenv` or `node-fetch` here — Vercel provides env vars and global fetch.

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed, use POST" });
  }

  try {
    const body = req.body || (req.headers["content-type"] && req.headers["content-type"].includes("application/json") ? await parseJsonBody(req) : null);
    const { code, code_verifier, redirect_uri } = body || {};

    if (!code || !code_verifier) {
      return res.status(400).json({ error: "Missing code or code_verifier in request body" });
    }

    // Support multiple env var name variants so you don't accidentally break it:
    const CLIENT_KEY = process.env.VITE_TIKTOK_CLIENT_KEY || process.env.TIKTOK_CLIENT_KEY || process.env.TIKTOK_CLIENT || null;
    const CLIENT_SECRET = process.env.TIKTOK_CLIENT_SECRET || process.env.VITE_TIKTOK_CLIENT_SECRET || null;
    const TOKEN_URL = process.env.TIKTOK_TOKEN_URL || "https://open.tiktokapis.com/v2/oauth/token";
    const USERINFO_URL = process.env.TIKTOK_USERINFO_URL || "https://open.tiktokapis.com/v2/user/info/";
    const REDIRECT_URI = redirect_uri || process.env.VITE_TIKTOK_REDIRECT_URI || process.env.TIKTOK_REDIRECT_URI || null;

    // sanity checks:
    if (!CLIENT_KEY || !CLIENT_SECRET) {
      console.error("Missing TikTok credentials. Env keys present:", {
        VITE_TIKTOK_CLIENT_KEY: !!process.env.VITE_TIKTOK_CLIENT_KEY,
        TIKTOK_CLIENT_KEY: !!process.env.TIKTOK_CLIENT_KEY,
        TIKTOK_CLIENT_SECRET: !!process.env.TIKTOK_CLIENT_SECRET,
      });
      return res.status(500).json({ error: "Server missing TikTok credentials (set VITE_TIKTOK_CLIENT_KEY and TIKTOK_CLIENT_SECRET in Vercel env)" });
    }
    if (!REDIRECT_URI) {
      console.error("Missing REDIRECT_URI env.", { redirect_uri_provided: !!redirect_uri });
      return res.status(500).json({ error: "Server missing redirect URI (set VITE_TIKTOK_REDIRECT_URI or TIKTOK_REDIRECT_URI in env)" });
    }

    // 1) Exchange code -> tokens
    const tokenParams = new URLSearchParams();
    tokenParams.append("client_key", CLIENT_KEY);
    tokenParams.append("client_secret", CLIENT_SECRET);
    tokenParams.append("grant_type", "authorization_code");
    tokenParams.append("code", code);
    tokenParams.append("redirect_uri", REDIRECT_URI);
    tokenParams.append("code_verifier", code_verifier);

    console.log("Calling TikTok token endpoint:", { TOKEN_URL, redirect_uri: REDIRECT_URI });

    const tokenResp = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: tokenParams.toString(),
    });

    const tokenText = await tokenResp.text();

    // If non-JSON, return helpful debug (prevents Unexpected token errors)
    let tokenJson = null;
    try {
      tokenJson = JSON.parse(tokenText);
    } catch (err) {
      console.error("TikTok token exchange returned non-JSON response:", tokenText.slice(0, 1000));
      return res.status(502).json({
        error: "TikTok token exchange returned non-JSON",
        status: tokenResp.status,
        raw: tokenText,
        debug_hint: "Check TIKTOK_TOKEN_URL, client_key, client_secret, redirect_uri; TikTok may return an HTML error page."
      });
    }

    if (!tokenResp.ok || !tokenJson.access_token) {
      console.error("TikTok token exchange failed:", tokenResp.status, tokenJson);
      return res.status(tokenResp.status || 502).json({
        error: "TikTok token exchange failed",
        status: tokenResp.status,
        body: tokenJson
      });
    }

    // 2) Attempt to fetch user info server-side (avoid CORS, centralize API key use)
    const accessToken = tokenJson.access_token || tokenJson.data?.access_token;
    const openId = tokenJson.open_id || tokenJson.data?.open_id || tokenJson.openid || null;

    if (!accessToken) {
      console.error("No access_token present in token response", tokenJson);
      return res.status(502).json({ error: "No access_token present in token response", tokens: tokenJson });
    }

    // Build user info URL
    const userUrl = new URL(USERINFO_URL);
    userUrl.searchParams.set("access_token", accessToken);
    if (openId) userUrl.searchParams.set("open_id", openId);

    try {
      const userResp = await fetch(userUrl.toString(), { method: "GET" });
      const userText = await userResp.text();

      let userJson = null;
      try {
        userJson = JSON.parse(userText);
      } catch (e) {
        console.warn("TikTok userinfo returned non-JSON:", userText.slice(0, 1000));
        // Return tokens and note userinfo failed without fatally failing the exchange
        return res.status(200).json({
          tokens: tokenJson,
          profile: null,
          userinfo_error: { status: userResp.status, raw: userText },
          redirectUrl: "/"
        });
      }

      if (!userResp.ok) {
        console.warn("TikTok userinfo fetch failed:", userResp.status, userJson);
        return res.status(200).json({
          tokens: tokenJson,
          profile: null,
          userinfo_error: { status: userResp.status, body: userJson },
          redirectUrl: "/"
        });
      }

      // Success: tokens and user profile
      return res.status(200).json({
        tokens: tokenJson,
        profile: userJson,
        redirectUrl: "/"
      });
    } catch (userinfoErr) {
      console.error("Failed fetching TikTok userinfo:", String(userinfoErr));
      return res.status(200).json({
        tokens: tokenJson,
        profile: null,
        userinfo_error: String(userinfoErr),
        redirectUrl: "/"
      });
    }
  } catch (err) {
    console.error("Exchange handler exception:", err);
    // Return helpful message to frontend
    return res.status(500).json({ error: "Internal server error", details: String(err) });
  }
}

// Helper to parse raw json body in serverless when req.body may be empty (some Vercel setups)
async function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => {
      try {
        resolve(JSON.parse(data || "{}"));
      } catch (e) {
        reject(e);
      }
    });
    req.on("error", reject);
  });
}
