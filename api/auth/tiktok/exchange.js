// /api/auth/tiktok/exchange.js
// Uses the runtime's global fetch (Node 18+ on Vercel has global fetch).
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const { code, code_verifier, redirect_uri } = req.body || {};

    if (!code || !code_verifier) {
      console.error("Missing code or code_verifier:", { codePresent: !!code, codeVerifierPresent: !!code_verifier });
      return res.status(400).json({ error: "Missing code or code_verifier" });
    }

    const {
      TIKTOK_CLIENT_KEY,
      TIKTOK_CLIENT_SECRET,
      TIKTOK_REDIRECT_URI,
      TIKTOK_TOKEN_URL = "https://open.tiktokapis.com/v2/oauth/token"
    } = process.env;

    if (!TIKTOK_CLIENT_KEY || !TIKTOK_CLIENT_SECRET || !TIKTOK_REDIRECT_URI) {
      console.error("Missing TikTok env vars:", { TIKTOK_CLIENT_KEY: !!TIKTOK_CLIENT_KEY, TIKTOK_CLIENT_SECRET: !!TIKTOK_CLIENT_SECRET, TIKTOK_REDIRECT_URI: !!TIKTOK_REDIRECT_URI });
      return res.status(500).json({ error: "TikTok server configuration missing" });
    }

    // Build url-encoded body required by TikTok
    const params = new URLSearchParams();
    params.append("client_key", TIKTOK_CLIENT_KEY);
    params.append("client_secret", TIKTOK_CLIENT_SECRET);
    params.append("grant_type", "authorization_code");
    params.append("code", code);
    params.append("redirect_uri", redirect_uri || TIKTOK_REDIRECT_URI);
    params.append("code_verifier", code_verifier);

    console.log("Posting to TikTok token URL:", TIKTOK_TOKEN_URL);
    console.log("Request body (first 200 chars):", params.toString().slice(0, 200));

    // use global fetch (Node 18+). No node-fetch import required.
    const tokenRes = await fetch(TIKTOK_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString()
    });

    const text = await tokenRes.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch (err) {
      console.warn("TikTok returned non-JSON body:", text.slice(0, 500));
      return res.status(502).json({ error: "TikTok returned invalid JSON", raw: text });
    }

    if (!tokenRes.ok || data.error) {
      console.error("TikTok token exchange failed:", tokenRes.status, data);
      return res.status(tokenRes.status || 502).json({ error: "TikTok token exchange failed", body: data });
    }

    console.log("TikTok token exchange success: ", { has_access_token: !!data.access_token });

    // success — return tokens and optional redirect
    return res.status(200).json({ ok: true, tokens: data, redirectUrl: "/" });
  } catch (err) {
    console.error("Exchange handler error:", err);
    return res.status(500).json({ error: "Internal server error", details: String(err) });
  }
}
