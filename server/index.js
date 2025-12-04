// server/index.js
import express from "express";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import bodyParser from "body-parser";
import fs from "fs";
import cookieParser from "cookie-parser";

// NOTE: import both exchange and fetchTikTokUserInfo from tiktok.js
import { exchangeTikTokCode, fetchTikTokUserInfo } from "./tiktok.js";
import profileRoutes from "./routes/profile.js";

// optional: mount express-style callback router if present (server/api/auth/tiktok/callback.js)
import tiktokCallbackRouter from "./api/auth/tiktok/callback.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log(">>> STARTING leaderbox/server/index.js — PID", process.pid);
console.log(">>> index.js loaded from", __filename);
console.log(">>> cwd:", process.cwd());

const app = express();
const PORT = Number(process.env.PORT || 4000);

// middlewares
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());

// request logger
app.use((req, res, next) => {
  console.log(`[REQ] ${new Date().toISOString()} ${req.method} ${req.originalUrl}`);
  next();
});

// runtime env for frontend
app.get("/config.js", (req, res) => {
  const js = `window.__ENV = ${JSON.stringify({
    VITE_TIKTOK_CLIENT_KEY: process.env.VITE_TIKTOK_CLIENT_KEY || "",
    VITE_TIKTOK_REDIRECT_URI: process.env.VITE_TIKTOK_REDIRECT_URI || "",
    LEADERBOX_SERVER_BASE: process.env.LEADERBOX_SERVER_BASE || "",
  })};`;
  res.setHeader("Content-Type", "application/javascript");
  res.send(js);
});

// health routes
app.get("/api/_health", (req, res) => res.json({ ok: true, msg: "server-up", time: Date.now() }));
app.get("/api/_whoami", (req, res) =>
  res.json({ ok: true, cwd: process.cwd(), dirname: __dirname })
);

// mount profile router with try/catch for visibility
try {
  app.use("/api/profile", profileRoutes);
  console.log(">>> mounted profileRoutes at /api/profile");
} catch (err) {
  console.error("Failed to mount profileRoutes:", err);
}

// mount tiktok callback router if present
try {
  app.use("/api/auth/tiktok", tiktokCallbackRouter);
  console.log(">>> mounted TikTok callback router at /api/auth/tiktok");
} catch (err) {
  console.warn("tiktokCallbackRouter not mounted (maybe missing):", err);
}

/**
 * PKCE exchange endpoint (server-side)
 *
 * Steps:
 *  - Exchange code -> tokens via exchangeTikTokCode
 *  - Best-effort: fetch user info via fetchTikTokUserInfo(tokens)
 *  - Normalize common shapes into { open_id, display_name, avatar, raw }
 *  - Return { tokens, profile, redirectUrl }
 *
 * This keeps secrets on the server and gives the frontend a normalized profile object.
 */
app.post("/api/auth/tiktok/exchange", async (req, res) => {
  try {
    const { code, code_verifier, redirect_uri } = req.body || {};
    if (!code || !code_verifier) {
      return res.status(400).json({ error: "Missing code or code_verifier" });
    }

    // 1) Exchange authorization code for tokens
    let tokens;
    try {
      tokens = await exchangeTikTokCode({ code, code_verifier, redirect_uri });
    } catch (err) {
      console.error("exchangeTikTokCode failed:", err && (err.body || err.message || err));
      // Surface vendor response if available
      return res.status(502).json({ error: "token_exchange_failed", detail: err && (err.body || String(err)) });
    }

    // 2) Attempt to fetch user info (best-effort)
    let profile = null;
    try {
      const ui = await fetchTikTokUserInfo(tokens);

      // ui shapes differ across TikTok APIs. Normalize:
      // Common shapes:
      //  - { data: { user: { ... } } }
      //  - { data: { ... } }
      //  - { user: { ... } }
      //  - { ... }
      const userObj =
        (ui && (ui.data || ui.user || ui.data === null))
          ? (ui.data?.user || ui.user || ui.data)
          : ui || {};

      const open_id =
        tokens?.open_id ||
        tokens?.data?.open_id ||
        userObj?.open_id ||
        userObj?.openId ||
        userObj?.id ||
        userObj?.openid ||
        null;

      // display_name / nickname / unique_id / displayName
      const display_name =
        userObj?.display_name ||
        userObj?.nickname ||
        userObj?.unique_id ||
        userObj?.displayName ||
        userObj?.name ||
        null;

      // avatar might be nested or have several variants
      const avatar =
        userObj?.avatar ||
        userObj?.avatar_large ||
        userObj?.avatar_url ||
        userObj?.avatarUrl ||
        userObj?.avatar_larger ||
        null;

      profile = {
        raw: ui,
        open_id,
        display_name,
        avatar,
      };
    } catch (uiErr) {
      // Non-fatal — log and continue returning tokens so frontend can still function
      console.warn("fetchTikTokUserInfo failed (continuing):", uiErr && (uiErr.body || uiErr.message || uiErr));
    }

    // 3) Return tokens + profile (profile may be null if fetch failed)
    return res.status(200).json({
      tokens,
      profile,
      redirectUrl: "/",
      message: "token_exchange_successful",
    });
  } catch (err) {
    console.error("Unhandled /api/auth/tiktok/exchange error:", err && (err.stack || err));
    return res.status(500).json({ error: "internal_server_error", message: String(err) });
  }
});

// serve frontend build if present
const buildPath = path.resolve(__dirname, "../client/build");
if (fs.existsSync(buildPath)) {
  app.use(express.static(buildPath));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api/") || req.path === "/config.js") return next();
    res.sendFile(path.join(buildPath, "index.html"));
  });
} else {
  app.get("/", (req, res) => res.send("<h1>Leaderbox server running</h1><p>No frontend build found.</p>"));
}

// start server; listen on all interfaces so other tools (ngrok) can hit it if you want
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server listening on http://0.0.0.0:${PORT}  (PID ${process.pid})`);
  console.log(">>> Server ready, test: curl http://127.0.0.1:4000/api/profile");
});
