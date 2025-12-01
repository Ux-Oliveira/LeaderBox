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
  if (!VITE_TIKTOK_CLIENT_KEY || !TIKTOK_CLIENT_SECRET) throw new Error("TikTok credentials missing");

  const params = new URLSearchParams();
  params.append("client_key", VITE_TIKTOK_CLIENT_KEY);
  params.append("client_secret", TIKTOK_CLIENT_SECRET);
  params.append("grant_type", "authorization_code");
  params.append("code", code);
  params.append("redirect_uri", redirect_uri || VITE_TIKTOK_REDIRECT_URI);
  params.append("code_verifier", code_verifier);

  const res = await fetch(TIKTOK_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch (e) {
    throw new Error(`TikTok returned non-JSON from token exchange: ${text}`);
  }

  if (!res.ok || !json.access_token) {
    // return the JSON so caller can log it
    const err = new Error("No access_token returned from TikTok token exchange");
    err.body = json;
    err.status = res.status;
    throw err;
  }

  return json; // includes access_token, maybe open_id, etc.
}

/**
 * Utility: fetch user info server-side
 * Accepts tokenResponse (the json returned from exchangeTikTokCode)
 */
export async function fetchTikTokUserInfo(tokenResponse) {
  // Preferred: TikTok v2 expects access_token (or Authorization header + open_id)
  const accessToken = tokenResponse.access_token || tokenResponse.data?.access_token;
  const openId = tokenResponse.open_id || tokenResponse.data?.open_id || tokenResponse.openid || null;

  // Try query param first (common for some TikTok endpoints)
  const url = new URL(TIKTOK_USERINFO_URL);
  if (accessToken) url.searchParams.set("access_token", accessToken);
  if (openId) url.searchParams.set("open_id", openId);

  const res = await fetch(url.toString(), { method: "GET" });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch (e) {
    throw new Error(`TikTok returned non-JSON from user info: ${text}`);
  }
  if (!res.ok) {
    const err = new Error("TikTok user info fetch failed");
    err.body = json;
    err.status = res.status;
    throw err;
  }
  return json;
}
