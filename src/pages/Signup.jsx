import React from "react";
import Support from "../components/Support";
import Support from "/pages/ComingSoon";

function getRuntimeEnv(varName, fallback = "") {
  if (typeof window !== "undefined" && window.__ENV && window.__ENV[varName]) {
    return window.__ENV[varName];
  }
  if (typeof window !== "undefined" && typeof import.meta !== "undefined" && import.meta.env && import.meta.env[varName]) {
    return import.meta.env[varName];
  }
  return fallback;
}

export default function Signup() {
  const CLIENT_KEY = getRuntimeEnv("VITE_TIKTOK_CLIENT_KEY", "");
  const REDIRECT_URI = getRuntimeEnv("VITE_TIKTOK_REDIRECT_URI", "");
  const SCOPES = "user.info.basic";

  // Letterboxd / Auth0 settings (frontend)
  const LBX_AUTH0_DOMAIN = getRuntimeEnv("VITE_LETTERBOXD_AUTH0_DOMAIN", "");
  const LBX_CLIENT_ID = getRuntimeEnv("VITE_LETTERBOXD_CLIENT_ID", "");
  const LBX_REDIRECT_URI = getRuntimeEnv("VITE_LETTERBOXD_REDIRECT_URI", "https://leaderbox.co/auth/letterboxd/callback");
  const LBX_SCOPE = "openid profile email";

  if (!CLIENT_KEY) console.error("❌ ERROR: VITE_TIKTOK_CLIENT_KEY not loaded.");
  if (!REDIRECT_URI) console.error("❌ ERROR: VITE_TIKTOK_REDIRECT_URI not loaded.");
  if (!LBX_AUTH0_DOMAIN || !LBX_CLIENT_ID) console.warn("Letterboxd (Auth0) not configured in runtime env - Letterboxd button will be hidden.");

  function generateState(length = 32) {
    const array = new Uint8Array(length);
    window.crypto.getRandomValues(array);
    return Array.from(array, (dec) => ("0" + dec.toString(16)).slice(-2)).join("");
  }

  function base64urlEncode(arrayBuffer) {
    const bytes = new Uint8Array(arrayBuffer);
    let binary = "";
    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }

  function generateCodeVerifier(length = 64) {
    const array = new Uint8Array(length);
    window.crypto.getRandomValues(array);
    // use random bytes hex -> good entropy
    return Array.from(array, (b) => ("0" + b.toString(16)).slice(-2)).join("");
  }

  async function createCodeChallenge(codeVerifier) {
    const encoder = new TextEncoder();
    const digest = await window.crypto.subtle.digest("SHA-256", encoder.encode(codeVerifier));
    return base64urlEncode(digest);
  }

  async function startTikTokLogin() {
    if (!CLIENT_KEY || !REDIRECT_URI) {
      alert("TikTok configuration missing. Check console for details.");
      return;
    }

    const state = generateState(24);
    const codeVerifier = generateCodeVerifier(64);
    const codeChallenge = await createCodeChallenge(codeVerifier);

    // store for callback verification
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

  // --- Letterboxd (via Auth0 tenant) start ---
  async function startLetterboxdLogin() {
    if (!LBX_AUTH0_DOMAIN || !LBX_CLIENT_ID || !LBX_REDIRECT_URI) {
      alert("Letterboxd (Auth0) configuration missing. Check console for details.");
      return;
    }

    const state = generateState(24);
    const codeVerifier = generateCodeVerifier(64);
    const codeChallenge = await createCodeChallenge(codeVerifier);

    sessionStorage.setItem("lbx_oauth_state", state);
    sessionStorage.setItem("lbx_code_verifier", codeVerifier);

    const params = new URLSearchParams({
      client_id: LBX_CLIENT_ID,
      response_type: "code",
      scope: LBX_SCOPE,
      redirect_uri: LBX_REDIRECT_URI,
      state,
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
      // prompt=consent can be added if you want explicit consent each time
    });

    // Use Auth0 authorize endpoint
    window.location.href = `https://${LBX_AUTH0_DOMAIN}/authorize?${params.toString()}`;
  }

  return (
    <div style={{ maxWidth: 560, margin: "40px auto", padding: 24 }}>
      <h2>Create an account</h2>
      <p>Click below to continue with TikTok or Letterboxd</p>

      <div style={{ display: "flex", gap: 12 }}>
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

        {LBX_AUTH0_DOMAIN && LBX_CLIENT_ID ? (
          <button
            onClick={() => navigate("/coming-soon")}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 12,
              padding: "10px 16px",
              borderRadius: 8,
              border: "none",
              cursor: "pointer",
              background: "#1b1b1b",
              color: "white",
              fontWeight: 600,
            }}
          >
            Continue with Letterboxd
          </button>
        ) : (
          <div style={{ alignSelf: "center", color: "#777" }}>Letterboxd (Auth0) not configured</div>
        )}
      </div>
      <Support />
    </div>
  );
}
