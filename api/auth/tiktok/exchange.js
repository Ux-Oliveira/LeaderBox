// api/auth/tiktok/exchange.js
export default async function handler(req, res) {
  try {
    console.log("=== exchange function invoked ===");
    console.log("Method:", req.method);
    console.log("Headers:", Object.keys(req.headers).slice(0,50));
    console.log("Body keys:", req.body ? Object.keys(req.body) : "NO BODY");

    // Quick env snapshot (do NOT log secrets in production; this is temporary)
    console.log("Env present:", {
      TIKTOK_CLIENT_KEY: !!process.env.TIKTOK_CLIENT_KEY,
      TIKTOK_CLIENT_SECRET: !!process.env.TIKTOK_CLIENT_SECRET,
      TIKTOK_REDIRECT_URI: !!process.env.TIKTOK_REDIRECT_URI,
      TIKTOK_TOKEN_URL: process.env.TIKTOK_TOKEN_URL
    });

    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return res.status(405).json({ error: "Method Not Allowed" });
    }

    const { code, code_verifier, redirect_uri } = req.body || {};
    if (!code) return res.status(400).json({ error: "Missing code" });
    if (!code_verifier) return res.status(400).json({ error: "Missing code_verifier" });

    // Build form body
    const params = new URLSearchParams();
    params.append("client_key", process.env.TIKTOK_CLIENT_KEY || "");
    params.append("client_secret", process.env.TIKTOK_CLIENT_SECRET || "");
    params.append("grant_type", "authorization_code");
    params.append("code", code);
    params.append("redirect_uri", redirect_uri || process.env.TIKTOK_REDIRECT_URI || "");
    params.append("code_verifier", code_verifier);

    console.log("Calling TikTok token endpoint:", process.env.TIKTOK_TOKEN_URL);
    console.log("Outgoing params (first 400 chars):", params.toString().slice(0,400));

    // use global fetch (Node 18+ on Vercel)
    const tokenRes = await fetch(process.env.TIKTOK_TOKEN_URL || "https://open.tiktokapis.com/v2/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });

    const text = await tokenRes.text().catch(e => {
      console.error("Failed to read token response text:", e);
      return "";
    });

    console.log("TikTok status:", tokenRes.status);
    console.log("TikTok raw response (first 800 chars):", text.slice(0,800));

    let tokenJson;
    try { tokenJson = JSON.parse(text); } catch(e) { tokenJson = { raw: text }; }

    if (!tokenRes.ok) {
      console.error("TikTok returned error:", tokenJson);
      return res.status(tokenRes.status || 502).json({ error: "TikTok token exchange failed", body: tokenJson });
    }

    console.log("Token exchange ok, keys:", Object.keys(tokenJson));
    return res.status(200).json({ ok: true, tokens: tokenJson, redirectUrl: "/" });
  } catch (err) {
    console.error("Exchange handler fatal error:", err);
    return res.status(500).json({ error: "Internal server error", details: String(err) });
  }
}
