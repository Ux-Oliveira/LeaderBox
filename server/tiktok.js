import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();

const {
  TIKTOK_CLIENT_KEY,
  TIKTOK_CLIENT_SECRET,
  TIKTOK_REDIRECT_URI,
  TIKTOK_TOKEN_URL = "https://open.tiktokapis.com/v2/oauth/token"
} = process.env;

// Correct endpoint now
export function getTikTokAuthURL({ state = "" } = {}) {
  const url = new URL("https://www.tiktok.com/v2/auth/authorize");
  url.searchParams.set("client_key", TIKTOK_CLIENT_KEY);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "user.info.basic");
  url.searchParams.set("redirect_uri", TIKTOK_REDIRECT_URI);
  if (state) url.searchParams.set("state", state);
  return url.toString();
}

export async function exchangeTikTokCode({ code, code_verifier, redirect_uri }) {
  if (!code) throw new Error("Missing code for TikTok exchange");

  const body = {
    client_key: TIKTOK_CLIENT_KEY,
    client_secret: TIKTOK_CLIENT_SECRET,
    code,
    grant_type: "authorization_code",
    redirect_uri: redirect_uri || TIKTOK_REDIRECT_URI
  };

  if (code_verifier) body.code_verifier = code_verifier;

  const res = await fetch(TIKTOK_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

  let data;
  try {
    data = await res.json();
  } catch (err) {
    throw new Error(`TikTok response not JSON: ${err.message}`);
  }

  if (!res.ok || data.error) {
    console.error("TikTok token error response:", data);
    const err = new Error(data.message || "TikTok token exchange failed");
    err.status = res.status;
    err.body = data;
    throw err;
  }

  return data;
}
