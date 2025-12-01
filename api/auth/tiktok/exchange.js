// temp-debug-exchange.js - minimal single-variant exchange (deploy this to test)
import fetch from "node-fetch";

function formString(obj){
  const p = new URLSearchParams();
  Object.entries(obj).forEach(([k,v])=>{
    if (v !== undefined && v !== null) p.append(k, String(v));
  });
  return p.toString();
}

export default async function handler(req, res){
  if (req.method !== "POST") {
    res.setHeader("Allow","POST");
    return res.status(405).json({ error: "Method not allowed, use POST" });
  }
  try {
    const { code, code_verifier, redirect_uri } = req.body || {};
    if (!code) return res.status(400).json({ error: "Missing code" });

    const CLIENT_KEY = process.env.VITE_TIKTOK_CLIENT_KEY || process.env.TIKTOK_CLIENT_KEY;
    const CLIENT_SECRET = process.env.TIKTOK_CLIENT_SECRET;
    const TOKEN_URL = process.env.TIKTOK_TOKEN_URL || "https://open.tiktokapis.com/v2/oauth/token/";

    // canonical web/server request (no PKCE)
    const params = {
      grant_type: "authorization_code",
      code,
      client_key: CLIENT_KEY,
      client_secret: CLIENT_SECRET,
      redirect_uri: redirect_uri || process.env.VITE_TIKTOK_REDIRECT_URI
    };

    const bodyStr = formString(params);

    const r = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: bodyStr,
    });

    const text = await r.text();

    // return the exact server status/text for debugging on frontend
    return res.status(200).json({
      debug: {
        triedUrl: TOKEN_URL,
        status: r.status,
        ok: r.ok,
        rawText: text.slice(0, 4000) // keep response size sane
      }
    });
  } catch (err) {
    console.error("debug exchange err:", err);
    return res.status(500).json({ error: "internal", details: String(err) });
  }
}
