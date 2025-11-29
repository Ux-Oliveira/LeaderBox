// api/auth/tiktok/exchange.js
// Vercel-friendly serverless handler — uses global fetch (Node 18+)
import { randomUUID } from "node:crypto";

const {
  TIKTOK_CLIENT_KEY,
  TIKTOK_CLIENT_SECRET,
  TIKTOK_REDIRECT_URI,
  TIKTOK_TOKEN_URL = "https://open.tiktokapis.com/v2/oauth/token"
} = process.env;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    // parse JSON body (Vercel should already parse, but be defensive)
    const contentType = req.headers["content-type"] || "";
    let payload;
    if (contentType.includes("application/json")) {
      payload = req.body;
    } else {
      // fallback: try to parse text
      const text = typeof req.body === "string" ? req.body : "";
      payload = text ? JSON.parse(text) : {};
    }

    const { code, code_verifier, redirect_uri } = payload || {};

    if (!code) return res.status(400).json({ error: "Missing 'code' in request body" });
    if (!code_verifier) return res.status(400).json({ error: "Missing 'code_verifier' in request body" });

    if (!TIKTOK_CLIENT_KEY || !TIKTOK_CLIENT_SECRET || !TIKTOK_REDIRECT_URI) {
      console.error("[tiktok/exchange] Missing TikTok env vars.");
      return res.status(500).json({
        error: "Server misconfiguration. Ensure TIKTOK_CLIENT_KEY, TIKTOK_CLIENT_SECRET, TIKTOK_REDIRECT_URI are set."
      });
    }

    const effectiveRedirectUri = redirect_uri || TIKTOK_REDIRECT_URI;

    // Log safe info for debugging
    console.log("[tiktok/exchange] exchanging code for tokens. redirect_uri:", effectiveRedirectUri);

    // build url-encoded body for TikTok
    const params = new URLSearchParams();
    params.append("client_key", TIKTOK_CLIENT_KEY);
    params.append("client_secret", TIKTOK_CLIENT_SECRET);
    params.append("grant_type", "authorization_code");
    params.append("code", code);
    params.append("redirect_uri", effectiveRedirectUri);
    params.append("code_verifier", code_verifier);

    const resp = await fetch(TIKTOK_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Accept": "application/json"
      },
      body: params.toString()
    });

    const raw = await resp.text();
    let data;
    try {
      data = raw ? JSON.parse(raw) : {};
    } catch (e) {
      console.error("[tiktok/exchange] Could not parse TikTok response as JSON:", e.message);
      return res.status(502).json({ error: "Invalid JSON from TikTok", raw });
    }

    if (!resp.ok) {
      console.error("[tiktok/exchange] TikTok returned error:", resp.status, data);
      return res.status(resp.status || 502).json({ error: "TikTok token exchange failed", body: data });
    }

    // Success: set a session cookie (example) and return tokens
    const sessionId = randomUUID();
    const isProd = process.env.NODE_ENV === "production";
    // Set cookie securely in prod
    const cookieParts = [`sessionId=${sessionId}`, "HttpOnly", "SameSite=Lax", `Max-Age=${60 * 60 * 24 * 7}`];
    if (isProd) cookieParts.push("Secure");
    res.setHeader("Set-Cookie", cookieParts.join("; "));

    console.log("[tiktok/exchange] success, open_id:", data.open_id || "(none)");
    return res.status(200).json({ ok: true, tokens: data, redirectUrl: "/" });
  } catch (err) {
    console.error("[tiktok/exchange] handler error:", err);
    return res.status(500).json({ error: "Internal server error", details: String(err?.message || err) });
  }
}
