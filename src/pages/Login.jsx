import React from "react";
import { v4 as uuidv4 } from "uuid";

function base64urlencode(str) {
  return btoa(String.fromCharCode.apply(null, new Uint8Array(str)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function generateCodeChallenge(verifier) {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return base64urlencode(digest);
}

function generateCodeVerifier() {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return base64urlencode(array);
}

export default function TikTokLoginButton() {
  const handleLogin = async () => {
    const codeVerifier = generateCodeVerifier();
    const state = uuidv4();

    sessionStorage.setItem("tiktok_code_verifier", codeVerifier);
    sessionStorage.setItem("tiktok_oauth_state", state);

    const codeChallenge = await generateCodeChallenge(codeVerifier);

    const CLIENT_KEY = import.meta.env.VITE_TIKTOK_CLIENT_KEY;
    const REDIRECT_URI = import.meta.env.VITE_TIKTOK_REDIRECT_URI;

    const authUrl = `https://www.tiktok.com/v2/auth/authorize?client_key=${CLIENT_KEY}&response_type=code&scope=user.info.basic&redirect_uri=${encodeURIComponent(
      REDIRECT_URI
    )}&state=${state}&code_challenge=${codeChallenge}&code_challenge_method=S256`;

    window.location.href = authUrl;
  };

  return <button onClick={handleLogin}>Login with TikTok</button>;
}
