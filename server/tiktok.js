// server/tiktok.js
// Robust token exchange + userinfo helpers for TikTok Login Kit (v2-ish).
// Uses node-fetch (Node 18+ native fetch ok). Returns parsed JSON or throws.

import fetch from "node-fetch";
import dotenv from "dotenv";
dotenv.config();

const {
  VITE_TIKTOK_CLIENT_KEY,
  TIKTOK_CLIENT_SECRET,
  VITE_TIKTOK_REDIRECT_URI,
  TIKTOK_TOKEN_URL = "https://open.tiktokapis.com/v2/oauth/token",
  TIKTOK_USERINFO_URL = "https://open.tiktokapis.com/v2/user/info/"
} = process.env;

export async function exchangeTikTokCode({ code, code_verifier, redirect_uri }) {
  if (!code || !code_verifier) throw new Error("Missing code or code_verifier");
  const CLIENT_KEY = VITE_TIKTOK_CLIENT_KEY || process.env.TIKTOK_CLIENT_KEY;
  const CLIENT_SECRET = TIKTOK_CLIENT_SECRET || process.env.TIKTOK_CLIENT_SECRET;
  if (!CLIENT_KEY || !CLIENT_SECRET) throw new Error("TikTok credentials missing");

  const params = new URLSearchParams();
  params.append("client_key", CLIENT_KEY);
  params.append("client_secret", CLIENT_SECRET);
  params.append("grant_type", "authorization_code");
  params.append("code", code);
  if (redirect_uri) params.append("redirect_uri", redirect_uri);
  if (code_verifier) params.append("code_verifier", code_verifier);

  const res = await fetch(TIKTOK_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  const text = await res.text();
  let json;
  try { json = text ? JSON.parse(text) : {}; } catch (e) {
    const err = new Error("TikTok returned non-JSON from token exchange");
    err.raw = text;
    throw err;
  }

  if (!res.ok || !json.access_token) {
    const err = new Error("Token exchange failed");
    err.status = res.status;
    err.body = json;
    throw err;
  }

  // Return the raw token JSON (may include open_id)
  return json;
}

/**
 * fetchTikTokUserInfo(tokenResponse)
 * - Tries Authorization: Bearer first, then query param fallback.
 * - Normalizes shape into { raw, open_id, display_name, avatar } or returns null if not obtainable.
 */
export async function fetchTikTokUserInfo(tokenResponse) {
  if (!tokenResponse) return null;
  const accessToken = tokenResponse.access_token || tokenResponse.data?.access_token || null;
  const openId = tokenResponse.open_id || tokenResponse.data?.open_id || tokenResponse.openid || null;

  const base = TIKTOK_USERINFO_URL;

  // Helper: normalize many possible shapes
  function normalizeUserJson(uiJson) {
    if (!uiJson) return null;
    const candidate = (uiJson.data && (uiJson.data.user || uiJson.data)) || uiJson.user || uiJson || {};
    const open_id =
      candidate.open_id ||
      candidate.openId ||
      candidate.openid ||
      openId ||
      tokenResponse.open_id ||
      tokenResponse.data?.open_id ||
      null;

    const display_name =
      candidate.display_name ||
      candidate.nickname ||
      candidate.unique_id ||
      candidate.displayName ||
      candidate.name ||
      candidate.username ||
      null;

    const avatar =
      candidate.avatar ||
      candidate.avatar_large ||
      candidate.avatar_url ||
      candidate.avatarUrl ||
      candidate.profile_image_url ||
      candidate.profile_pic ||
      null;

    return { raw: uiJson, open_id, display_name, avatar };
  }

  // Try header method
  try {
    const hdrRes = await fetch(base, {
      method: "GET",
      headers: accessToken ? { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" } : { "Content-Type": "application/json" },
    });
    const txt = await hdrRes.text();
    let json = null;
    try { json = txt ? JSON.parse(txt) : {}; } catch (e) { json = null; }
    if (hdrRes.ok && json) {
      return normalizeUserJson(json);
    }
  } catch (err) {
    // console.warn and fallthrough to query param approach
  }

  // Query param fallback
  try {
    const url = new URL(base);
    if (accessToken) url.searchParams.set("access_token", accessToken);
    if (openId) url.searchParams.set("open_id", openId);
    const qRes = await fetch(url.toString(), { method: "GET" });
    const txt = await qRes.text();
    let json = null;
    try { json = txt ? JSON.parse(txt) : {}; } catch (e) { json = null; }
    if (qRes.ok && json) return normalizeUserJson(json);
  } catch (err) {
    // give up
  }

  return null;
}
