// server/tiktok.js
import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();

const {
  TIKTOK_CLIENT_KEY,
  TIKTOK_CLIENT_SECRET,
  TIKTOK_REDIRECT_URI,
  TIKTOK_TOKEN_URL = "https://open.tiktokapis.com/v2/oauth/token"
} = process.env;

/**
 * Returns the frontend TikTok authorization URL
 * @param {Object} options
 * @param {string} options.state - code_verifier from frontend (PKCE)
 * @param {string} options.code_challenge - sha256 challenge
 */
export function getTikTokAuthURL({ state = "", code_challenge } = {}) {
  const url = new URL("https://www.tiktok.com/v2/auth/authorize");
  url.searchParams.set("client_key", TIKTOK_CLIENT_KEY);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "user.info.basic");
  url.searchParams.set("redirect_uri", TIKTOK_REDIRECT_URI);
  if (state) url.searchParams.set("state", state);
  if (code_challenge) url.searchParams.set("code_challenge", code_challenge);
  if (code_challenge) url.searchParams.set("code_challenge_method", "S256");
  return url.toString();
}

/**
 * Exchanges the TikTok code for access_token using PKCE
 * @param {Object} options
 * @param {string} options.code - code from TikTok
 * @param {string} options.code_verifier - original code_verifier from frontend
 * @param {string} [options.redirect_uri] - optional override for redirect_uri
 */
export async function exchangeTikTokCode({ code, code_verifier, redirect_uri }) {
  if (!code) throw new Error("Missing code for exchange");
  if (!TIKTOK_CLIENT_KEY || !TIKTOK_CLIENT_SECRET) throw new Error("TikTok credentials missing on server");

  const params = new URLSearchParams();
  params.append("client_key", TIKTOK_CLIENT_KEY);
  params.append("client_secret", TIKTOK_CLIENT_SECRET);
  params.append("grant_type", "authorization_code");
  params.append("code", code);
  params.append("redirect_uri", redirect_uri || TIKTOK_REDIRECT_URI);
  if (!code_verifier) throw new Error("Missing code_verifier for PKCE");
  params.append("code_verifier", code_verifier);

  const res = await fetch(TIKTOK_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch (e) {
    throw new Error(`TikTok returned non-JSON: ${text}`);
  }

  if (!res.ok || !json.access_token) {
    console.error("TikTok exchange failed:", json);
    throw new Error("No access_token returned from exchange");
  }

  return json;
}
