// server/tiktok.js (Node / serverless)
import fetch from "node-fetch";
import dotenv from "dotenv";
dotenv.config();

const {
  TIKTOK_CLIENT_KEY,
  TIKTOK_CLIENT_SECRET,
  TIKTOK_REDIRECT_URI
} = process.env;

export function getTikTokAuthURL() {
  const params = new URLSearchParams({
    client_key: TIKTOK_CLIENT_KEY,
    scope: "user.info.basic",
    response_type: "code",
    redirect_uri: TIKTOK_REDIRECT_URI
  });
  return `https://www.tiktok.com/auth/authorize?${params.toString()}`;
}

export async function exchangeTikTokCode(code) {
  const params = new URLSearchParams({
    client_key: TIKTOK_CLIENT_KEY,
    client_secret: TIKTOK_CLIENT_SECRET,
    code,
    grant_type: "authorization_code",
    redirect_uri: TIKTOK_REDIRECT_URI
  });

  const res = await fetch("https://open.tiktokapis.com/v2/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString()
  });

  if (!res.ok) throw new Error(`Token exchange failed: ${res.status}`);
  return res.json();
}
