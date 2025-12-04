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

        // === NEW: robust profile normalization & server save ===
        let serverProfileCandidate = null;

        // If server returned a normalized profile object, prefer it
        if (data.profile && (data.profile.open_id || data.profile.raw)) {
          serverProfileCandidate = {
            open_id:
              data.profile.open_id ||
              (data.profile.raw && (data.profile.raw.open_id || data.profile.raw.data?.open_id)) ||
              null,
            nickname: data.profile.display_name || data.profile.nickname || null,
            avatar: data.profile.avatar || null,
            raw: data.profile.raw || data.profile,
          };
        }

        // Fallback to tokens or nested data if no profile from server
        if (!serverProfileCandidate) {
          const open_id =
            tokens?.open_id ||
            tokens?.data?.open_id ||
            (data.profile && data.profile.raw && data.profile.raw.data && data.profile.raw.data.open_id) ||
            null;
          const nickname =
            tokens?.display_name ||
            tokens?.nickname ||
            (data.profile && (data.profile.display_name || data.profile.nickname)) ||
            null;
          const avatar =
            tokens?.avatar_url ||
            tokens?.avatar ||
            (data.profile && data.profile.avatar) ||
            null;

          if (open_id) {
            serverProfileCandidate = { open_id, nickname, avatar, raw: data.profile || tokens || {} };
          }
        }

        // store client-side immediately (so UI can update even if server save fails)
        if (serverProfileCandidate) {
          localStorage.setItem("tiktok_profile", JSON.stringify(serverProfileCandidate));
        }

        // Save minimal profile to your server-side /api/profile
        const serverBase =
          process.env.NODE_ENV === "development"
            ? "http://localhost:4000"
            : (getRuntimeEnv("LEADERBOX_SERVER_BASE") || window.location.origin);

        if (serverProfileCandidate && serverProfileCandidate.open_id) {
          try {
            const profilePayload = {
              open_id: serverProfileCandidate.open_id,
              nickname: serverProfileCandidate.nickname,
              avatar: serverProfileCandidate.avatar,
            };

            console.log("Posting profile to server:", serverBase + "/api/profile", profilePayload);

            const profileRes = await fetch(`${serverBase}/api/profile`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(profilePayload),
            });

            const text = await profileRes.text();
            let profileData = null;
            try {
              profileData = JSON.parse(text);
            } catch (err) {
              // non-JSON OK — just log it
              console.warn("Profile POST returned non-JSON. Body:", text);
            }

            if (profileRes.ok && profileData && profileData.profile) {
              localStorage.setItem("tiktok_profile", JSON.stringify(profileData.profile));
              console.log("Saved server profile to localStorage:", profileData.profile);
            } else {
              console.warn("Profile save responded not-ok:", profileRes.status, profileData || text);
            }
          } catch (err) {
            console.error("Failed to save profile to server:", err);
            // do not block login — profile still stored client-side
          }
        } else {
          console.warn("No open_id found — skipping server profile save.");
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
