// server/tiktok.js
import fetch from "node-fetch";
import dotenv from "dotenv";
dotenv.config();

const { TIKTOK_CLIENT_KEY, TIKTOK_CLIENT_SECRET } = process.env;

export async function exchangeTikTokCode({ code, code_verifier, redirect_uri }) {
  if (!code || !redirect_uri) throw new Error("Missing code or redirect_uri");

  const params = new URLSearchParams({
    client_key: TIKTOK_CLIENT_KEY,
    client_secret: TIKTOK_CLIENT_SECRET,
    code,
    grant_type: "authorization_code",
    redirect_uri
  });

  if (code_verifier) params.append("code_verifier", code_verifier);

  const res = await fetch("https://open.tiktokapis.com/v2/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString()
  });

  const text = await res.text();
  let tokenJson;
  try { tokenJson = JSON.parse(text); } catch { tokenJson = { raw: text }; }

  if (!res.ok) throw new Error(`Token exchange failed: ${res.status} ${text}`);

  return tokenJson;
}
