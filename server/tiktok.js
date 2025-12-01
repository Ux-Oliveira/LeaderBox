import fetch from "node-fetch";
import dotenv from "dotenv";
dotenv.config();

const {
  VITE_TIKTOK_CLIENT_KEY,
  TIKTOK_CLIENT_SECRET,
  VITE_TIKTOK_REDIRECT_URI,
  TIKTOK_TOKEN_URL = "https://open.tiktokapis.com/v2/oauth/token"
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
  try { json = JSON.parse(text); } catch { throw new Error(`TikTok returned non-JSON: ${text}`); }

  if (!res.ok || !json.access_token) throw new Error("No access_token returned from TikTok");
  return json;
}
