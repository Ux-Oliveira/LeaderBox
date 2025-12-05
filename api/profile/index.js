// api/profile/index.js
import fs from "fs";
import path from "path";
import os from "os";

const IS_DEV = (process.env.NODE_ENV || "development") === "development";

// Use local ./data during dev; use OS temp dir in production (Vercel)
const DATA_DIR = IS_DEV
  ? path.resolve("./data")
  : path.join(os.tmpdir(), "leaderbox_data"); // writable on serverless platforms
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

// Robust parse — works if req.body is already object, string JSON, etc.
function parseJsonSafely(body, headers = {}) {
  if (body && typeof body === "object" && !Buffer.isBuffer(body)) return body;
  if (typeof body === "string") {
    try { return JSON.parse(body); } catch (e) {
      try { return JSON.parse(body.trim()); } catch (e2) { throw new Error("Invalid JSON"); }
    }
  }
  // Some environments provide rawBody under req.rawBody or similar; ignore here.
  if (headers && headers["content-type"] && headers["content-type"].includes("application/json")) {
    // we expected JSON but got something else
    throw new Error("Invalid JSON");
  }
  return {};
}

export default function handler(req, res) {
  try {
    // CORS + preflight
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,DELETE,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") return res.status(204).end();

    // Normalize pathname (serverless req.url often includes the route after the file)
    const rawUrl = typeof req.url === "string" ? req.url : "";
    let pathname = rawUrl.split("?")[0] || "";

    // Normalize variants: '/complete', '/profile/complete', '/api/profile/complete'
    if (pathname.startsWith("/api/profile")) pathname = pathname.replace("/api/profile", "") || "/";
    if (pathname.startsWith("/profile")) pathname = pathname.replace("/profile", "") || "/";
    if (!pathname.startsWith("/")) pathname = "/" + pathname;

    console.log(`[api/profile] ${req.method} ${req.url} -> normalized pathname="${pathname}" on DATA_DIR=${DATA_DIR}`);

    // parse body defensively
    let body = {};
    try {
      body = parseJsonSafely(req.body, req.headers || {});
    } catch (err) {
      console.warn("[api/profile] JSON parse failed:", err.message || err);
      return res.status(400).json({ error: "invalid_json", message: String(err.message || err) });
    }

    // ----- HANDLE POST /complete (serverless-friendly) -----
    // When the client posts to /api/profile/complete (file-based routes hit this handler,
    // with req.url === '/complete' or variants), we handle the "choose nickname + avatar" flow.
    if (req.method === "POST" && pathname.endsWith("/complete")) {
      try {
        const { open_id, nickname: rawNickname, avatar } = body || {};
        if (!open_id) return res.status(400).json({ error: "missing_open_id" });
        if (!rawNickname) return res.status(400).json({ error: "missing_nickname" });
        if (!avatar) return res.status(400).json({ error: "missing_avatar" });

        // normalize nickname: remove leading spaces and @, ensure letters/numbers/underscores/hyphen allowed
        let nicknameClean = String(rawNickname).trim();
        if (nicknameClean.startsWith("@")) nicknameClean = nicknameClean.slice(1);
        if (!/^[A-Za-z0-9_\-]{3,30}$/.test(nicknameClean)) {
          return res.status(400).json({ error: "invalid_nickname", message: "Use 3-30 chars: letters, numbers, -, _" });
        }
        const finalNickname = "@" + nicknameClean;

        const users = loadUsers();

        // Check for uniqueness (case-insensitive)
        const taken = users.find((u) => u.nickname && String(u.nickname).toLowerCase() === finalNickname.toLowerCase());
        if (taken) {
          // If the taken entry is the same open_id (shouldn't happen), allow re-affirm
          if (String(taken.open_id) !== String(open_id)) {
            return res.status(409).json({ error: "nickname_taken", message: "Nickname already in use" });
          }
        }

        // find or create the user
        let user = users.find((u) => String(u.open_id) === String(open_id));
        if (!user) {
          // new user — create with chosen nickname and avatar
          user = {
            open_id,
            nickname: finalNickname,
            avatar,
            wins: 0,
            losses: 0,
            level: 1,
            deck: [],
            created_at: Date.now(),
            updated_at: Date.now(),
          };
          users.push(user);
          saveUsers(users);
          return res.json({ ok: true, profile: user });
        }

        // if user already had a custom nickname (starts with '@' and not default), prevent change
        const hadCustom = user.nickname && user.nickname !== `@${user.open_id}` && String(user.nickname).startsWith("@");
        if (hadCustom && String(user.nickname).toLowerCase() !== String(finalNickname).toLowerCase()) {
          return res.status(403).json({ error: "nickname_immutable", message: "Nickname can't be changed after initial set" });
        }

        // otherwise set nickname and avatar
        user.nickname = finalNickname;
        user.avatar = avatar;
        user.updated_at = Date.now();
        saveUsers(users);
        return res.json({ ok: true, profile: user });
      } catch (err) {
        console.error("profile complete error:", err);
        return res.status(500).json({ error: "internal_server_error", message: String(err) });
      }
    }

    // ----- NORMAL /api/profile HANDLERS -----
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
      // If we reach here, it's POST to base /api/profile (not /complete)
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
      console.log("[api/profile] saved open_id=", open_id, "path=", USERS_PATH);
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
