// api/auth/tiktok/exchange.js
import fetch from "node-fetch";
import { randomUUID } from "node:crypto";

const {
  TIKTOK_CLIENT_KEY,
  TIKTOK_CLIENT_SECRET,
  TIKTOK_REDIRECT_URI,
  TIKTOK_TOKEN_URL = "https://open.tiktokapis.com/v2/oauth/token"
} = process.env;

/**
 * POST /api/auth/tiktok/exchange
 * Body: { code, code_verifier, redirect_uri? }
 *
 * Notes:
 * - TikTok expects application/x-www-form-urlencoded for the token exchange.
 * - We do not print secrets to logs. We do log existence of env values and non-sensitive info.
 */
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const body = typeof req.body === "object" ? req.body : JSON.parse(req.body || "{}");
    const { code, code_verifier, redirect_uri } = body || {};

    if (!code) return res.status(400).json({ error: "Missing 'code' in request body" });
    // code_verifier is required if you used PKCE on the client
    if (!code_verifier) return res.status(400).json({ error: "Missing 'code_verifier' in request body" });

    // Basic env checks (do not log secrets)
    if (!TIKTOK_CLIENT_KEY || !TIKTOK_CLIENT_SECRET || !TIKTOK_REDIRECT_URI) {
      console.error("TikTok environment not configured. One of the required env vars is missing.");
      return res.status(500).json({
        error: "TikTok server configuration missing. Ensure TIKTOK_CLIENT_KEY, TIKTOK_CLIENT_SECRET, TIKTOK_REDIRECT_URI are set."
      });
    }

    const effectiveRedirectUri = redirect_uri || TIKTOK_REDIRECT_URI;

    // Debugging log (safe): show which redirect URI is being used and that code was received
    console.log("[tiktok/exchange] Received code. Using redirect_uri:", effectiveRedirectUri);

    // Build URL-encoded payload for TikTok
    const params = new URLSearchParams();
    params.append("client_key", TIKTOK_CLIENT_KEY);
    params.append("client_secret", TIKTOK_CLIENT_SECRET);
    params.append("grant_type", "authorization_code");
    params.append("code", code);
    params.append("redirect_uri", effectiveRedirectUri);
    params.append("code_verifier", code_verifier);

    // Post to TikTok token endpoint
    console.log("[tiktok/exchange] Posting to TikTok token URL:", TIKTOK_TOKEN_URL);
    const tokenRes = await fetch(TIKTOK_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Accept": "application/json"
      },
      body: params.toString()
    });

    const text = await tokenRes.text();
    let data;
    try {
      data = text ? JSON.parse(text) : {};
    } catch (err) {
      console.error("[tiktok/exchange] Failed parsing token response as JSON:", err.message);
      // include raw response to help debugging, but keep it in response body (not in logs)
      return res.status(502).json({ error: "TikTok returned invalid JSON", raw: text });
    }

    if (!tokenRes.ok) {
      // TikTok returned an error (4xx/5xx). Forward useful details to the client.
      console.error("[tiktok/exchange] TikTok token exchange failed:", tokenRes.status, data?.error || data);
      return res.status(tokenRes.status || 502).json({
        error: "TikTok token exchange failed",
        status: tokenRes.status,
        body: data
      });
    }

    // Success. data should contain access_token, refresh_token, open_id, etc.
    console.log("[tiktok/exchange] Token exchange OK. open_id:", data.open_id || "unknown");

    // Create a session cookie (example). Adjust name and value to your needs.
    const sessionId = randomUUID();
    const isProd = process.env.NODE_ENV === "production";

    // Build cookie options string
    const cookieParts = [
      `sessionId=${sessionId}`,
      "HttpOnly",
      "SameSite=Lax",
      `Max-Age=${60 * 60 * 24 * 7}` // one week
    ];
    if (isProd) cookieParts.push("Secure");

    // Set cookie header (Vercel will propagate this)
    res.setHeader("Set-Cookie", cookieParts.join("; "));

    // Optionally: persist sessionId -> tokens mapping in DB here

    // Return token payload to client (you can filter secrets if you want)
    return res.status(200).json({
      ok: true,
      tokens: data,
      redirectUrl: "/"
    });
  } catch (err) {
    console.error("[tiktok/exchange] Handler error:", err);
    return res.status(500).json({ error: "Internal server error", details: String(err?.message || err) });
  }
}
