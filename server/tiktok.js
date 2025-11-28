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
 * Build the TikTok authorize URL (no PKCE challenge included here).
 * If you want server-side PKCE, you'd generate code_challenge here.
 * We keep this simple because your frontend already implements PKCE.
 */
export function getTikTokAuthURL(overrideRedirectUri) {
  const redirect_uri = overrideRedirectUri || TIKTOK_REDIRECT_URI || "";
  const scope = "user.info.basic";
  const response_type = "code";

  return (
    "https://www.tiktok.com/auth/authorize?" +
    new URLSearchParams({
      client_key: TIKTOK_CLIENT_KEY || "",
      scope,
      response_type,
      redirect_uri
    }).toString()
  );
}

/**
 * Exchange authorization code for tokens.
 * Accepts an object with: { code, code_verifier?, redirect_uri? }
 * Returns the parsed JSON from TikTok (or throws on HTTP error).
 */
export async function exchangeTikTokCode({ code, code_verifier, redirect_uri }) {
  if (!code) {
    throw new Error("Missing code");
  }

  const tokenUrl = TIKTOK_TOKEN_URL;

  // Use form-encoded body (typical for OAuth token endpoints)
  const params = new URLSearchParams();
  params.append("client_key", TIKTOK_CLIENT_KEY || "");
  if (TIKTOK_CLIENT_SECRET) params.append("client_secret", TIKTOK_CLIENT_SECRET);
  params.append("grant_type", "authorization_code");
  params.append("code", code);
  params.append("redirect_uri", redirect_uri || TIKTOK_REDIRECT_URI || "");

  if (code_verifier) {
    params.append("code_verifier", code_verifier);
  }

  const res = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString()
  });

  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch (e) {
    // Not JSON — wrap raw text
    json = { raw: text };
  }

  if (!res.ok) {
    const err = new Error("TikTok token exchange failed");
    err.status = res.status;
    err.body = json;
    throw err;
  }

  return json;
}
