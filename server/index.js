// server/index.js
import express from "express";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import bodyParser from "body-parser";
import fs from "fs";
import cookieParser from "cookie-parser";
import profileRoutes from "./routes/profile.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 4000;

// basic middlewares
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());

// request logger (very helpful)
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// health / quick test route
app.get("/api/_health", (req, res) => {
  return res.json({ ok: true, msg: "server-up", time: Date.now() });
});

// mount profile router
app.use("/api/profile", profileRoutes);
console.log(">>> mounted profileRoutes at /api/profile");

// runtime config for client (if used)
app.get("/config.js", (req, res) => {
  const js = `window.__ENV = ${JSON.stringify({
    VITE_TIKTOK_CLIENT_KEY: process.env.VITE_TIKTOK_CLIENT_KEY || "",
    VITE_TIKTOK_REDIRECT_URI: process.env.VITE_TIKTOK_REDIRECT_URI || "",
    LEADERBOX_SERVER_BASE: process.env.LEADERBOX_SERVER_BASE || "",
  })};`;
  res.setHeader("Content-Type", "application/javascript");
  res.send(js);
});

// static frontend build (if present)
const buildPath = path.resolve(__dirname, "../client/build");
if (fs.existsSync(buildPath)) {
  app.use(express.static(buildPath));

  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api/") || req.path === "/config.js") return next();
    res.sendFile(path.join(buildPath, "index.html"));
  });
} else {
  app.get("/", (req, res) => {
    res.send("Server running — no frontend build found.");
  });
}

app.listen(PORT, () => console.log(`Server listening on http://localhost:${PORT}`));
