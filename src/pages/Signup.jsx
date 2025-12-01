import React from "react";
import { v4 as uuidv4 } from "uuid";

function base64urlEncode(arrayBuffer) {
  const bytes = new Uint8Array(arrayBuffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function generateCodeVerifier(length = 64) {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, b => ("0" + b.toString(16)).slice(-2)).join("");
}

async function generateCodeChallenge(verifier) {
  const encoder = new TextEncoder();
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(verifier));
  return base64urlEncode(digest);
}

export default function Signup() {
  const CLIENT_KEY = window.__ENV?.VITE_TIKTOK_CLIENT_KEY || "";
  const REDIRECT_URI = window.__ENV?.VITE_TIKTOK_REDIRECT_URI || "";
  const SCOPES = "user.info.basic";

  async function startTikTokLogin() {
    if (!CLIENT_KEY || !REDIRECT_URI) return alert("TikTok config missing");

    const state = uuidv4();
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = await generateCodeChallenge(codeVerifier);

    sessionStorage.setItem("tiktok_oauth_state", state);
    sessionStorage.setItem("tiktok_code_verifier", codeVerifier);

    const params = new URLSearchParams({
      client_key: CLIENT_KEY,
      response_type: "code",
      scope: SCOPES,
      redirect_uri: REDIRECT_URI,
      state,
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
    });

    window.location.href = `https://www.tiktok.com/v2/auth/authorize?${params.toString()}`;
  }

  return (
    <div style={{ maxWidth: 560, margin: "40px auto", padding: 24 }}>
      <h2>Create an account</h2>
      <p>Click below to continue with TikTok</p>
      <button
        onClick={startTikTokLogin}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 12,
          padding: "10px 16px",
          borderRadius: 8,
          border: "none",
          cursor: "pointer",
          background: "#010101",
          color: "white",
          fontWeight: 600,
        }}
      >
        Continue with TikTok
      </button>
    </div>
  );
}
