// server/index.js
import express from "express";
import dotenv from "dotenv";
import fetch from "node-fetch";
import path from "node:path";
import { fileURLToPath } from "url";
import bodyParser from "body-parser";
import cookieParser from "cookie-parser";
import cors from "cors";
import { randomUUID } from "node:crypto";
import fs from "fs";

import { getTikTokAuthURL, exchangeTikTokCode } from "./tiktok.js";

// NEW: import the callback router you created
import tiktokCallbackRouter from "./api/auth/tiktok/callback.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 4000;

// Read env values
const {
  TIKTOK_CLIENT_KEY,
  TIKTOK_CLIENT_SECRET,
  TIKTOK_REDIRECT_URI,
  TIKTOK_TOKEN_URL = "https://open.tiktokapis.com/v2/oauth/token",
  FRONTEND_BUILD_PATH = "../client/build"
} = process.env;

// Basic checks
if (!TIKTOK_CLIENT_KEY || !TIKTOK_CLIENT_SECRET || !TIKTOK_REDIRECT_URI) {
  console.warn("Warning: Missing TikTok env vars. Please set TIKTOK_CLIENT_KEY, TIKTOK_CLIENT_SECRET, TIKTOK_REDIRECT_URI in .env");
}

// Middlewares
app.use(cors({
  origin: true,
  credentials: true
}));
app.use(bodyParser.json());
app.use(cookieParser());

// ---------------------------
// Serve runtime config to browser
// ---------------------------
app.get("/config.js", (req, res) => {
  const publicEnv = {
    REACT_APP_TIKTOK_CLIENT_KEY: TIKTOK_CLIENT_KEY || "",
    REACT_APP_TIKTOK_REDIRECT_URI: TIKTOK_REDIRECT_URI || ""
  };

  const js = `
    // injected at runtime by server. Safe to read from client.
    window.__ENV = ${JSON.stringify(publicEnv, null, 2)};
    // some bundlers expect process.env to exist - create a tiny shim
    if (typeof window.process === "undefined") {
      window.process = { env: ${JSON.stringify(publicEnv, null, 2)} };
    } else {
      window.process.env = Object.assign({}, window.process.env || {}, ${JSON.stringify(publicEnv, null, 2)});
    }
  `;
  res.setHeader("Content-Type", "application/javascript");
  res.send(js);
});

// ---------------------------
// Mount the callback router so TikTok can redirect server-side if needed
// e.g. https://leaderbox.co/auth/tiktok/callback
// This lets you support both flows: server-callback and frontend PKCE.
// ---------------------------
app.use("/auth/tiktok", tiktokCallbackRouter);

// ---------------------------
// Optional: server-side login entrypoint
// ---------------------------
app.get("/auth/tiktok/login", (req, res) => {
  const url = getTikTokAuthURL();
  return res.redirect(url);
});

// ---------------------------
// Exchange endpoint (frontend PKCE -> server exchange)
// ---------------------------
app.post("/api/auth/tiktok/exchange", async (req, res) => {
  try {
    const { code, code_verifier, redirect_uri } = req.body || {};

    if (!code) {
      return res.status(400).json({ error: "Missing code in request body" });
    }

    const effectiveRedirectUri = redirect_uri || TIKTOK_REDIRECT_URI;
    if (!effectiveRedirectUri) {
      return res.status(400).json({ error: "Missing redirect_uri (server-side fallback not configured)" });
    }

    let tokenJson;
    try {
      tokenJson = await exchangeTikTokCode({ code, code_verifier, redirect_uri: effectiveRedirectUri });
    } catch (err) {
      console.error("TikTok token exchange failed:", err.status || "", err.body || err.message || err);
      const status = err.status || 502;
      return res.status(status).json({
        error: "TikTok token exchange failed",
        status: status,
        body: err.body || err.message || null
      });
    }

    const sessionId = randomUUID();

    res.cookie("sessionId", sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 1000 * 60 * 60 * 24 * 7
    });

    return res.json({
      ok: true,
      tokens: tokenJson,
      redirectUrl: "/"
    });
  } catch (err) {
    console.error("Exchange error:", err);
    return res.status(500).json({ error: "Internal server error", details: String(err) });
  }
});

// ---------------------------
// Serve frontend static files (if available)
// ---------------------------
const buildCandidate = path.resolve(__dirname, FRONTEND_BUILD_PATH);
if (fs.existsSync(buildCandidate)) {
  console.log("Serving static frontend from:", buildCandidate);
  app.use(express.static(buildCandidate));

  // SPA fallback
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api/") || req.path === "/config.js") return next();
    res.sendFile(path.join(buildCandidate, "index.html"));
  });
} else {
  console.warn("Frontend build folder not found at", buildCandidate, "— server will still serve /config.js and API endpoints.");
  app.get("/", (req, res) => {
    res.setHeader("Content-Type", "text/html");
    res.send(`<html><head><script src="/config.js"></script></head><body>
      <h1>Server running</h1>
      <p>No frontend build found at ${buildCandidate} — build your frontend and place it there (or set FRONTEND_BUILD_PATH).</p>
    </body></html>`);
  });
}

// Start server
app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
