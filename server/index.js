// server/index.js
import express from "express";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import bodyParser from "body-parser";
import fs from "fs";
import cookieParser from "cookie-parser";

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

// request logger for debugging
app.use((req, res, next) => {
  console.log(`[REQ] ${new Date().toISOString()} ${req.method} ${req.originalUrl}`);
  next();
});

// mount profile router (your existing file)
import profileRoutes from "./routes/profile.js";
try {
  app.use("/api/profile", profileRoutes);
  console.log(">>> mounted profileRoutes at /api/profile");
} catch (err) {
  console.error("Failed to mount profileRoutes:", err);
}

// health & debug
app.get("/api/_health", (req, res) => res.json({ ok: true, msg: "server-up", time: Date.now() }));
app.get("/api/_whoami", (req, res) => res.json({ ok: true, cwd: process.cwd(), dirname: __dirname }));

// import exchange helper
import { exchangeTikTokCode, fetchTikTokUserInfo } from "./tiktok.js";

/**
 * POST /api/auth/tiktok/exchange
 * body: { code, code_verifier, redirect_uri }
 *
 * Returns: { tokens, profile, redirectUrl }
 */
app.post("/api/auth/tiktok/exchange", async (req, res) => {
  try {
    const { code, code_verifier, redirect_uri } = req.body || {};
    if (!code || !code_verifier) {
      return res.status(400).json({ error: "missing_code_or_code_verifier" });
    }

    console.log("[exchange] received code, beginning token exchange...");
    const tokenJson = await exchangeTikTokCode({ code, code_verifier, redirect_uri }).catch((err) => {
      console.error("[exchange] token exchange failed:", err && (err.stack || err), err && err.body ? err.body : "");
      throw err;
    });

    // Try fetching user profile (best-effort). We still return tokens if this fails.
    let profile = null;
    try {
      profile = await fetchTikTokUserInfo(tokenJson);
      // normalize naming (guarantee fields open_id/display_name/avatar)
      if (profile) {
        profile.open_id = profile.open_id || profile.raw?.data?.user?.open_id || profile.raw?.data?.openId || profile.raw?.open_id || null;
        profile.display_name = profile.display_name || profile.raw?.data?.user?.display_name || profile.raw?.display_name || profile.raw?.data?.user?.nickname || null;
        profile.avatar = profile.avatar || profile.raw?.data?.user?.avatar || profile.raw?.data?.user?.avatar_large || profile.raw?.avatar || null;
      }
    } catch (err) {
      console.warn("[exchange] user-info fetch failed (non-fatal):", err && (err.stack || err));
      // profile remains null or partial
    }

    // Build result object
    const result = {
      tokens: tokenJson,
      profile: profile || null,
      redirectUrl: "/",
    };

    // Attempt to save minimal profile to our /api/profile (best-effort)
    try {
      if (profile && profile.open_id) {
        const serverBase = `http://127.0.0.1:${PORT}`;
        const payload = {
          open_id: profile.open_id,
          nickname: profile.display_name || `@${profile.open_id}`,
          avatar: profile.avatar || null,
        };
        // Use localhost fetch to call our own route (safe, best-effort)
        const saveRes = await fetch(`${serverBase}/api/profile`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const saveText = await saveRes.text().catch(()=>"");
        try {
          const saveJson = saveText ? JSON.parse(saveText) : null;
          console.log("[exchange] profile save responded:", saveRes.status, saveJson || saveText.slice(0,300));
          // If server returned a profile, overwrite local profile in result.profile with that canonical version
          if (saveRes.ok && saveJson && saveJson.profile) result.profile = saveJson.profile;
        } catch(e) {
          console.warn("[exchange] profile save returned non-json:", saveText.slice(0,400));
        }
      } else {
        console.log("[exchange] skipping server profile save — no open_id found in fetched profile.");
      }
    } catch (err) {
      console.warn("[exchange] failed to save profile to /api/profile (non-fatal):", err && err.message);
    }

    console.log("[exchange] returning result to client (tokens + profile)");
    return res.status(200).json(result);
  } catch (err) {
    console.error("[exchange] unhandled error:", err && (err.stack || err));
    return res.status(500).json({ error: "internal_server_error", message: String(err) });
  }
});

// serve static build if present (optional)
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

// start server
app.listen(PORT, "127.0.0.1", () => {
  console.log(`Server listening on http://127.0.0.1:${PORT}  (PID ${process.pid})`);
  console.log(">>> Server ready, test: curl http://127.0.0.1:4000/api/profile");
});
