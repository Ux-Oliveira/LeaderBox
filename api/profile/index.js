// api/profile/index.js
import fs from "fs";
import path from "path";

const DATA_DIR = path.resolve("./data"); // ephemeral on Vercel
const USERS_PATH = path.join(DATA_DIR, "users.json");

function ensureDataFile() {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    if (!fs.existsSync(USERS_PATH)) fs.writeFileSync(USERS_PATH, "[]", "utf8");
  } catch (e) {
    console.error("ensureDataFile error:", e);
    throw e;
  }
}

function loadUsers() {
  ensureDataFile();
  try {
    const raw = fs.readFileSync(USERS_PATH, "utf8");
    return JSON.parse(raw || "[]");
  } catch (e) {
    console.warn("Failed to read users.json:", e);
    return [];
  }
}

function saveUsers(users) {
  ensureDataFile();
  const tmp = USERS_PATH + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(users, null, 2), "utf8");
  fs.renameSync(tmp, USERS_PATH);
}

function parseJsonSafely(body, headers = {}) {
  // If already an object, return it
  if (body && typeof body === "object" && !Array.isArray(body)) return body;

  // If it's a string, try to parse
  if (typeof body === "string") {
    try {
      return JSON.parse(body);
    } catch (e) {
      // Try trimming (PowerShell sometimes adds stray chars)
      try {
        return JSON.parse(body.trim());
      } catch (e2) {
        throw new Error("Invalid JSON");
      }
    }
  }

  // Some runtimes put rawBody on request (rare)
  if (headers && headers["content-type"] && headers["content-type"].includes("application/json")) {
    throw new Error("Invalid JSON");
  }

  // Nothing to parse — return empty object
  return {};
}

export default function handler(req, res) {
  try {
    // CORS + preflight
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,DELETE,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
      return res.status(204).end();
    }

    console.log(`[api/profile] ${req.method} ${req.url}`);

    // Robust body parsing (works for Vercel serverless + simple Express-like env)
    let body = {};
    try {
      body = parseJsonSafely(req.body, req.headers || {});
    } catch (err) {
      console.warn("[api/profile] JSON parse failed:", err.message || err);
      return res.status(400).json({ error: "invalid_json", message: String(err.message || err) });
    }

    if (req.method === "GET") {
      const { open_id } = req.query || {};
      const users = loadUsers();
      if (open_id) {
        const user = users.find((u) => String(u.open_id) === String(open_id));
        if (!user) return res.status(404).json({ error: "not_found" });
        return res.json({ ok: true, profile: user });
      }
      return res.json({ ok: true, profiles: users });
    }

    if (req.method === "POST") {
      // use parsed body (fall back to req.body if empty)
      const payload = (Object.keys(body).length ? body : (req.body || {}));
      console.log("[api/profile] POST body:", payload);

      const { open_id, nickname, avatar, wins, losses, level, deck } = payload || {};
      if (!open_id) return res.status(400).json({ error: "Missing open_id" });

      const users = loadUsers();
      let user = users.find((u) => u.open_id === open_id);

      if (!user) {
        user = {
          open_id,
          nickname: nickname || `@${open_id}`,
          avatar: avatar || null,
          wins: Number.isFinite(wins) ? parseInt(wins, 10) : 0,
          losses: Number.isFinite(losses) ? parseInt(losses, 10) : 0,
          level: Number.isFinite(level) ? parseInt(level, 10) : 1,
          deck: Array.isArray(deck) ? deck : [],
          created_at: Date.now(),
          updated_at: Date.now(),
        };
        users.push(user);
      } else {
        if (nickname !== undefined) user.nickname = nickname;
        if (avatar !== undefined) user.avatar = avatar;
        if (wins !== undefined) user.wins = Number.isFinite(wins) ? parseInt(wins, 10) : user.wins;
        if (losses !== undefined) user.losses = Number.isFinite(losses) ? parseInt(losses, 10) : user.losses;
        if (level !== undefined) user.level = Number.isFinite(level) ? parseInt(level, 10) : user.level;
        if (deck !== undefined) user.deck = Array.isArray(deck) ? deck : user.deck;
        user.updated_at = Date.now();
      }

      saveUsers(users);
      console.log("[api/profile] saved open_id=", open_id);
      return res.json({ ok: true, profile: user });
    }

    if (req.method === "DELETE") {
      const { open_id } = req.query || {};
      if (!open_id) return res.status(400).json({ error: "Missing open_id" });
      const users = loadUsers();
      const filtered = users.filter((u) => u.open_id !== open_id);
      if (filtered.length === users.length) return res.status(404).json({ error: "not_found" });
      saveUsers(filtered);
      return res.json({ ok: true });
    }

    res.setHeader("Allow", "GET,POST,DELETE,OPTIONS");
    return res.status(405).json({ error: "method_not_allowed" });
  } catch (err) {
    console.error("API /api/profile error:", err && (err.stack || err));
    return res.status(500).json({ error: "internal_server_error", message: String(err && err.message ? err.message : err) });
  }
}
