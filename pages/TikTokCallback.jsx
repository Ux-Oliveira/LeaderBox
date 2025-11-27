// src/pages/TikTokCallback.jsx
import React, { useEffect, useState } from "react";

/**
 * TikTok OAuth callback handler.
 * Place this component at the route you registered with TikTok as your redirect URI,
 * for example: /auth/tiktok/callback
 *
 * Behavior:
 * - Parses `code`, `state`, `error` from the querystring.
 * - Verifies `state` against sessionStorage value stored before redirect.
 * - Sends `code` to your server endpoint to exchange for tokens (server must have client_secret).
 *
 * Replace /api/auth/tiktok/exchange with your server path.
 */

export default function TikTokCallback() {
  const [status, setStatus] = useState("processing");
  const [message, setMessage] = useState("");

  useEffect(() => {
    (async () => {
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");
      const returnedState = params.get("state");
      const error = params.get("error");
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
      if (!storedState || storedState !== returnedState) {
        setStatus("error");
        setMessage("Invalid or missing state (possible CSRF).");
        return;
      }

      // Optional: clear stored state
      sessionStorage.removeItem("tiktok_oauth_state");

      setStatus("exchanging");
      setMessage("Exchanging code with server...");

      try {
        // Send the authorization code to your server for exchange.
        // Server endpoint must securely call TikTok token API using client_secret.
        const res = await fetch("/api/auth/tiktok/exchange", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ code })
        });

        if (!res.ok) {
          const txt = await res.text();
          throw new Error(`Server exchange failed: ${res.status} ${txt}`);
        }

        const data = await res.json();
        // Expected: server returns session token / user info / whatever your backend supplies.
        setStatus("success");
        setMessage("Logged in successfully. You may close this page or be redirected.");
        // Example: if server returned tokens or a redirect URL:
        if (data.redirectUrl) {
          window.location.href = data.redirectUrl;
        }
      } catch (err) {
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
      {status === "success" ? (
        <p>Success — redirecting or ready to use your session.</p>
      ) : status === "error" ? (
        <p>
          There was a problem. Check console and server logs. If you're developing locally, remember TikTok requires registered redirect URIs (often not plain localhost unless allowed).
        </p>
      ) : (
        <p>Working…</p>
      )}
    </div>
  );
}
