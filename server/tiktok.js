import fetch from "node-fetch";
import dotenv from "dotenv";
dotenv.config();

const {
  TIKTOK_CLIENT_KEY,
  TIKTOK_CLIENT_SECRET,
  TIKTOK_REDIRECT_URI,
} = process.env;

export function getTikTokAuthURL() {
  const scope = "user.info.basic";
  const response_type = "code";

  return (
    "https://www.tiktok.com/auth/authorize?" +
    new URLSearchParams({
      client_key: TIKTOK_CLIENT_KEY,
      scope,
      response_type,
      redirect_uri: TIKTOK_REDIRECT_URI,
    }).toString()
  );
}

export async function exchangeTikTokCode(code) {
  const tokenURL = "https://open.tiktokapis.com/v2/oauth/token/";

  const res = await fetch(tokenURL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_key: TIKTOK_CLIENT_KEY,
      client_secret: TIKTOK_CLIENT_SECRET,
      code,
      grant_type: "authorization_code",
      redirect_uri: TIKTOK_REDIRECT_URI,
    }),
  });

  return res.json();
}
