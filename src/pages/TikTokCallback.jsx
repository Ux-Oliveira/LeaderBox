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
          credentials: "same-origin",
        });

        // read raw text first for robust debugging
        const raw = await res.text();
        let data = null;
        try {
          data = JSON.parse(raw);
        } catch (e) {
          // Not JSON — show server response for debugging
          console.error("Exchange returned non-JSON:", raw);
          setStatus("error");
          setMessage(`Exchange returned non-JSON: ${raw.slice(0, 1000)}`);
          return;
        }

        console.log("Exchange response (parsed):", data);
        if (!res.ok) {
          setStatus("error");
          setMessage(`Server exchange failed: ${res.status} ${JSON.stringify(data).slice(0, 500)}`);
          return;
        }

        // success path
        sessionStorage.removeItem("tiktok_oauth_state");
        sessionStorage.removeItem("tiktok_code_verifier");

        const tokens = data.tokens || data?.tokens || data;
        if (tokens) {
          localStorage.setItem("tiktok_tokens", JSON.stringify(tokens));
        }
        if (data.profile) {
          localStorage.setItem("tiktok_profile", JSON.stringify(data.profile));
        }

        // ======================
        // SAVE PROFILE TO SERVER
        // ======================
        // (added block — posts minimal profile info to /api/profile and overwrites local tiktok_profile with server response)
        if (tokens?.open_id) {
          try {
            const profileRes = await fetch("/api/profile", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                open_id: tokens.open_id,
                nickname: tokens.display_name,
                avatar: tokens.avatar_url
              })
            });

            const profileData = await profileRes.json();
            // **FIX**: store profileData.profile if server wrapped it (server returns { ok: true, profile: user })
            const serverProfile = profileData?.profile || profileData;
            // store the server-returned profile (if any) in localStorage for the UI
            localStorage.setItem("tiktok_profile", JSON.stringify(serverProfile));
          } catch (err) {
            console.error("Failed to save profile:", err);
            // keep existing local profile if server save fails
          }
        }

        setStatus("success");
        setMessage("Logged in successfully. Redirecting...");
        setTimeout(() => {
          window.location.href = data.redirectUrl || "/";
        }, 700);
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
