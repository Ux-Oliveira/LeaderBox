// src/pages/TikTokCallback.jsx
import React, { useEffect, useState } from "react";

function getRuntimeEnv(varName, fallback = "") {
  if (typeof window !== "undefined" && window.__ENV && window.__ENV[varName]) {
    return window.__ENV[varName];
  }
  if (typeof window !== "undefined" && typeof import.meta !== "undefined" && import.meta.env && import.meta.env[varName]) {
    return import.meta.env[varName];
  }
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

      console.log("Callback URL params:", Object.fromEntries(params.entries()));

      if (error) {
        setStatus("error");
        setMessage(`Authorization error: ${error} ${params.get("error_description") || ""}`);
        return;
      }

      if (!code) {
        setStatus("error");
        setMessage("No authorization code received from TikTok.");
        return;
      }

      const storedState = sessionStorage.getItem("tiktok_oauth_state");
      const storedCodeVerifier = sessionStorage.getItem("tiktok_code_verifier");

      console.log("Stored state:", storedState);
      console.log("Returned state:", returnedState);
      console.log("Stored code_verifier:", storedCodeVerifier);

      if (!storedState || storedState !== returnedState || !storedCodeVerifier) {
        setStatus("error");
        setMessage("Invalid state or missing code_verifier. Cannot continue. (Check console logs)");
        return;
      }

      setStatus("exchanging");
      setMessage("Exchanging code with server...");

      try {
        const REDIRECT_URI = getRuntimeEnv("VITE_TIKTOK_REDIRECT_URI", window.location.origin + "/auth/tiktok/callback");

        const payload = { code, code_verifier: storedCodeVerifier, redirect_uri: REDIRECT_URI };
        console.log("Exchange payload (sent):", payload);

        const res = await fetch("/api/auth/tiktok/exchange", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          credentials: "include"
        });

        const text = await res.text();
        let data;
        try {
          data = JSON.parse(text);
        } catch (e) {
          data = { raw: text };
        }

        if (!res.ok) {
          console.error("Exchange failed. status:", res.status, "body:", data);
          setStatus("error");
          setMessage(`Server exchange failed: ${res.status} ${JSON.stringify(data).slice(0, 300)}`);
          return;
        }

        console.log("Exchange success:", data);

        // Clear PKCE storage now that exchange succeeded
        sessionStorage.removeItem("tiktok_oauth_state");
        sessionStorage.removeItem("tiktok_code_verifier");

        // PRIMARY: Save tokens to localStorage (so frontend can use them)
        // Structure depends on your exchange: adjust if tokens are under data.tokens.access_token etc.
        const tokens = data.tokens || data || null;
        if (tokens) {
          localStorage.setItem("tiktok_tokens", JSON.stringify(tokens));
        }

        // Try to fetch TikTok user profile using access_token (best-effort).
        // NOTE: TikTok's exact user-info endpoint or parameters may vary by API version.
        // Common v2 endpoint: https://open.tiktokapis.com/v2/user/info/
        // The exchange usually returns an access_token that can be passed as query / bearer token.
        let profile = null;
        try {
          const accessToken = tokens?.access_token || tokens?.data?.access_token || tokens?.data?.accessToken || tokens?.accessToken;
          if (accessToken) {
            // call TikTok v2 user info endpoint (most apps use ?open_id or ?access_token)
            // Try v2 user info (query param)
            const userInfoUrlV2 = `https://open.tiktokapis.com/v2/user/info/?access_token=${encodeURIComponent(accessToken)}`;
            const uRes = await fetch(userInfoUrlV2, { method: "GET" });
            const uText = await uRes.text();
            try {
              const uJson = JSON.parse(uText);
              if (uRes.ok && uJson) {
                // Inspect returned structure to pick name and avatar.
                // Common keys vary; try a few options.
                const uData = uJson.data || uJson;
                const nickname = uData?.user?.display_name || uData?.display_name || uData?.nickname || uData?.name || uData?.open_id;
                const avatar = uData?.user?.avatar_large || uData?.user?.avatar || uData?.avatar || uData?.avatar_url || uData?.picture;
                profile = { nickname: nickname || "TikTok user", pfp: avatar || null, raw: uJson };
              } else {
                console.warn("User info response not OK or empty:", uJson);
              }
            } catch (err) {
              console.warn("Failed parsing TikTok user info:", err, uText);
            }
          } else {
            console.warn("No access_token returned from exchange — cannot fetch user info.");
          }
        } catch (err) {
          console.warn("Fetching user profile failed:", err);
        }

        // If profile found, store it for now so ProfilePage can display it immediately
        if (profile) {
          localStorage.setItem("tiktok_profile", JSON.stringify(profile));
          console.log("Saved tiktok_profile to localStorage:", profile);
        }

        setStatus("success");
        setMessage("Logged in successfully. Redirecting...");

        // If the server gave a redirectUrl, follow it; otherwise go home.
        if (data.redirectUrl) window.location.href = data.redirectUrl;
        else window.location.href = "/";

      } catch (err) {
        console.error("Exchange exception:", err);
        setStatus("error");
        setMessage(err.message || "Unknown error during code exchange.");
      }
    })();
  }, []);

  return (
    <div style={{ maxWidth: 720, margin: "40px auto", padding: 24 }}>
      <h2>TikTok Authentication</h2>
      <p>Status: {status}</p>
      <pre style={{ whiteSpace: "pre-wrap", color: status === "error" ? "#a00" : "#333" }}>{message}</pre>
      {status === "processing" && <p>Working… (check console for diagnostic logs)</p>}
      {status === "error" && <p>See console logs. Keep this page open to copy logs & retry after fixes.</p>}
    </div>
  );
}
