import React, { useEffect, useState } from "react";

function getRuntimeEnv(varName, fallback = "") {
  if (typeof window !== "undefined" && window.__ENV && window.__ENV[varName]) return window.__ENV[varName];
  if (typeof window !== "undefined" && import.meta.env && import.meta.env[varName]) return import.meta.env[varName];
  return fallback;
}

export default function TikTokCallback() {
  const [status, setStatus] = useState("processing");
  const [message, setMessage] = useState("");

  useEffect(() => {
    (async () => {
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");
      const returnedState = params.get("state");
      const error = params.get("error");

      if (error) return setStatus("error") || setMessage(`Authorization error: ${error}`);
      if (!code) return setStatus("error") || setMessage("No authorization code received from TikTok.");

      const storedState = sessionStorage.getItem("tiktok_oauth_state");
      const storedCodeVerifier = sessionStorage.getItem("tiktok_code_verifier");

      if (!storedState || storedState !== returnedState || !storedCodeVerifier) {
        return setStatus("error") || setMessage("Invalid state or missing code_verifier.");
      }

      setStatus("exchanging");
      setMessage("Exchanging code for tokens...");

      try {
        const REDIRECT_URI = getRuntimeEnv("VITE_TIKTOK_REDIRECT_URI", window.location.origin + "/auth/tiktok/callback");
        const payload = { code, code_verifier: storedCodeVerifier, redirect_uri: REDIRECT_URI };

        const res = await fetch("/api/auth/tiktok/exchange", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(JSON.stringify(data));

        sessionStorage.removeItem("tiktok_oauth_state");
        sessionStorage.removeItem("tiktok_code_verifier");

        if (data.tokens) {
          localStorage.setItem("tiktok_tokens", JSON.stringify(data.tokens));

          // -----------------------------
          // FETCH TIKTOK USER INFO
          // -----------------------------
          try {
            const accessToken = data.tokens.access_token;
            const userRes = await fetch(
              `https://open.tiktokapis.com/v2/user/info/?access_token=${encodeURIComponent(accessToken)}`,
              { method: "GET" }
            );
            const userJson = await userRes.json();
            console.log("TikTok user info:", userJson);
            localStorage.setItem("tiktok_profile", JSON.stringify(userJson));
          } catch (userErr) {
            console.error("Failed to fetch TikTok user info:", userErr);
          }
        }

        setStatus("success");
        setMessage("Logged in successfully. Redirecting...");
        window.location.href = data.redirectUrl || "/";
      } catch (err) {
        console.error(err);
        setStatus("error");
        setMessage("Token exchange failed: " + err.message);
      }
    })();
  }, []);

  return (
    <div style={{ maxWidth: 720, margin: "40px auto", padding: 24 }}>
      <h2>TikTok Authentication</h2>
      <p>Status: {status}</p>
      <pre style={{ whiteSpace: "pre-wrap", color: status === "error" ? "#a00" : "#333" }}>{message}</pre>
    </div>
  );
}
