// api/auth/tiktok/exchange.js
import fetch from "node-fetch";

async function readReqBody(req) {
  if (req.body && Object.keys(req.body).length) return req.body;
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (c) => (data += c));
    req.on("end", () => {
      try { resolve(data ? JSON.parse(data) : {}); } catch (e) { reject(e); }
    });
    req.on("error", reject);
  });
}

function formString(obj) {
  const p = new URLSearchParams();
  Object.entries(obj).forEach(([k, v]) => {
    if (v !== undefined && v !== null) p.append(k, String(v));
  });
  return p.toString();
}

async function postForm(url, bodyString) {
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: bodyString,
  });
  const text = await r.text();
  let json = null;
  try { json = JSON.parse(text); } catch (e) { /* keep raw */ }
  return { ok: r.ok, status: r.status, text, json };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed, use POST" });
  }

  try {
    const body = await readReqBody(req);
    const { code, code_verifier, redirect_uri } = body || {};
    if (!code || !code_verifier) return res.status(400).json({ error: "Missing code or code_verifier" });

    // env / defaults
    const CLIENT_KEY = process.env.VITE_TIKTOK_CLIENT_KEY || process.env.TIKTOK_CLIENT_KEY || null;
    const CLIENT_SECRET = process.env.TIKTOK_CLIENT_SECRET || null;
    const DEFAULT_REDIRECT = process.env.VITE_TIKTOK_REDIRECT_URI || process.env.TIKTOK_REDIRECT_URI || null;
    const TOKEN_URLS = Array.from(new Set([
      process.env.TIKTOK_TOKEN_URL || "https://open.tiktokapis.com/v2/oauth/token",
      "https://open-api.tiktok.com/oauth/access_token"
    ]));
    const USERINFO_URL = process.env.TIKTOK_USERINFO_URL || "https://open.tiktokapis.com/v2/user/info/";

    if (!CLIENT_KEY) return res.status(500).json({ error: "Server missing CLIENT_KEY env (VITE_TIKTOK_CLIENT_KEY or TIKTOK_CLIENT_KEY)" });
    if (!DEFAULT_REDIRECT && !redirect_uri) {
      // not fatal - some endpoints don't want redirect; we'll try with/without
    }

    // Variants to try: include both with/without redirect_uri because TikTok sometimes rejects it
    const candidateRedirects = [redirect_uri || DEFAULT_REDIRECT, undefined]; // try given redirect first, then omit
    const variants = [];

    // param name variations
    const idKeys = [ "client_key", "client_id" ];

    for (const idKey of idKeys) {
      for (const useSecret of [true, false]) {
        for (const r of candidateRedirects) {
          const params = {
            grant_type: "authorization_code",
            code,
            code_verifier,
          };
          params[idKey] = CLIENT_KEY;
          if (useSecret && CLIENT_SECRET) params.client_secret = CLIENT_SECRET;
          if (r) params.redirect_uri = r;
          variants.push({ idKey, useSecret, redirectUsed: Boolean(r), params });
        }
      }
    }

    const attempts = [];
    let tokensJson = null;
    let used = null;

    for (const url of TOKEN_URLS) {
      for (const v of variants) {
        // skip combos that require secret if none provided
        if (v.useSecret && !CLIENT_SECRET) {
          attempts.push({ url, variant: v, skipped: "missing client_secret in env" });
          continue;
        }
        const bodyStr = formString(v.params);
        let resp;
        try {
          resp = await postForm(url, bodyStr);
        } catch (err) {
          attempts.push({ url, variant: v, error: String(err) });
          continue;
        }

        attempts.push({
          url,
          variant: { idKey: v.idKey, useSecret: v.useSecret, redirectUsed: v.redirectUsed },
          status: resp.status,
          ok: resp.ok,
          textSnippet: resp.text?.slice?.(0, 600),
          json: resp.json || null
        });

        if (resp.json && (resp.json.access_token || resp.json.data?.access_token)) {
          tokensJson = resp.json;
          used = { url, variant: { idKey: v.idKey, useSecret: v.useSecret, redirectUsed: v.redirectUsed } };
          break;
        }
      }
      if (tokensJson) break;
    }

    if (!tokensJson) {
      return res.status(400).json({
        error: "TikTok token exchange failed",
        reason: "no variant produced tokens",
        attempts,
        triedUrls: TOKEN_URLS
      });
    }

    // Normalize access_token/open_id
    const accessToken = tokensJson.access_token || tokensJson.data?.access_token;
    const openId = tokensJson.open_id || tokensJson.data?.open_id || tokensJson.openid || null;

    // Try fetch user profile server-side (best-effort)
    let profile = null;
    try {
      const u = new URL(USERINFO_URL);
      u.searchParams.set("access_token", accessToken);
      if (openId) u.searchParams.set("open_id", openId);
      const uresp = await fetch(u.toString());
      const utext = await uresp.text();
      try { profile = JSON.parse(utext); } catch (e) { profile = { nonJson: utext.slice(0,1000) }; }
    } catch (err) {
      profile = { fetchError: String(err) };
    }

    return res.status(200).json({
      ok: true,
      used,
      tokens: tokensJson,
      profile,
      attempts
    });

  } catch (err) {
    console.error("exchange handler exception:", err);
    return res.status(500).json({ error: "internal", details: String(err) });
  }
}
