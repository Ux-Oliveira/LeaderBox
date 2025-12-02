// server/index.js  -- diagnostic version
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

console.log("==== STARTING SERVER (diagnostic index.js) ====");
console.log("Working directory:", process.cwd());
console.log("__dirname:", __dirname);
console.log("NODE version:", process.version);
console.log("ENV PORT:", process.env.PORT);
console.log("Listing files in current folder:");
try {
  console.log(fs.readdirSync(__dirname).join(" | "));
} catch (e) {
  console.log("Could not list files:", e);
}

const app = express();
const PORT = Number(process.env.PORT || 4000);
const BIND_ADDR = process.env.BIND_ADDR || "127.0.0.1"; // explicit

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());

// request logger - verbose
app.use((req, res, next) => {
  console.log(`[REQ] ${new Date().toISOString()}  ${req.method} ${req.originalUrl}  (headers: ${Object.keys(req.headers).join(",")})`);
  next();
});

// very small inline profile router fallback (if ./routes/profile.js fails to import)
let profileRouterMounted = false;
try {
  // attempt to import your router if present
  const profilePath = path.join(__dirname, "routes", "profile.js");
  if (fs.existsSync(profilePath)) {
    console.log("Found routes/profile.js — attempting to import it");
    // dynamic import so errors don't totally crash
    const imported = await import(`./routes/profile.js`);
    const profileRoutes = imported.default || imported;
    app.use("/api/profile", profileRoutes);
    profileRouterMounted = true;
    console.log(">>> mounted profileRoutes at /api/profile (from routes/profile.js)");
  } else {
    console.warn("routes/profile.js NOT FOUND. mounting fallback minimal router at /api/profile");
  }
} catch (err) {
  console.error("Error importing routes/profile.js — mounting fallback router. Error:", err && err.stack ? err.stack : err);
}

// fallback minimal router (always mounted) — lets us test server reachability even if your router fails
import { Router } from "express";
const fallback = Router();
fallback.get("/", (req, res) => {
  res.json({ ok: true, profiles: [], note: profileRouterMounted ? "real router mounted" : "fallback router responding" });
});
fallback.get("/_health", (req, res) => {
  res.json({ ok: true, msg: "server-up", time: Date.now(), profileRouterMounted });
});
app.use("/api/profile-fallback", fallback);

// explicit health + test routes
app.get("/api/_health", (req, res) => {
  res.json({ ok: true, msg: "server-up", time: Date.now(), profileRouterMounted });
});
app.get("/api/_whoami", (req, res) => {
  res.json({ ok: true, cwd: process.cwd(), dirname: __dirname, profileRouterMounted });
});

// serve simple root when no frontend build
const buildPath = path.resolve(__dirname, "../client/build");
if (fs.existsSync(buildPath)) {
  console.log("Frontend build found at", buildPath);
  app.use(express.static(buildPath));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api/") || req.path === "/config.js") return next();
    res.sendFile(path.join(buildPath, "index.html"));
  });
} else {
  console.log("No frontend build found. root will show a plain message.");
  app.get("/", (req, res) => {
    res.send("Server running — no frontend build found (diagnostic).");
  });
}

app.listen(PORT, BIND_ADDR, () => {
  console.log(`Server listening at http://${BIND_ADDR}:${PORT}`);
  console.log("profileRouterMounted:", profileRouterMounted ? "YES" : "NO");
});
