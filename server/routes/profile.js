// server/routes/profile.js
import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Use server/data/users.json
const DATA_DIR = path.join(__dirname, "..", "data");
const USERS_PATH = path.join(DATA_DIR, "users.json");

function ensureDataFile() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(USERS_PATH)) fs.writeFileSync(USERS_PATH, "[]", "utf8");
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

function cleanNick(n) {
  if (n === undefined || n === null) return null;
  return String(n).trim().replace(/^@+/, "");
}

const router = express.Router();

// list all or query by nickname/open_id
router.get("/", (req, res) => {
  try {
    const users = loadUsers();
    const { nickname, open_id } = req.query;

    if (nickname) {
      const q = cleanNick(nickname);
      const qLower = q ? q.toLowerCase() : null;
      const user = users.find(u => {
        const nick = (u.nickname || "").toString().replace(/^@+/, "").toLowerCase();
        return (qLower && nick === qLower) || (u.open_id && String(u.open_id).toLowerCase() === String(nickname).toLowerCase());
      });
      if (!user) return res.status(404).json({ ok: false, error: "not_found" });
      return res.json({ ok: true, profile: user });
    }

    if (open_id) {
      const user = users.find(u => String(u.open_id) === String(open_id));
      if (!user) return res.status(404).json({ ok: false, error: "not_found" });
      return res.json({ ok: true, profile: user });
    }

    // default: return list (beware size on prod)
    return res.json({ ok: true, profiles: users });
  } catch (err) {
    console.error("profile list error:", err);
    return res.status(500).json({ error: "internal_server_error", message: String(err) });
  }
});

// single by open_id path (mounted as /api/profile/:open_id)
router.get("/:open_id", (req, res) => {
  try {
    const { open_id } = req.params;
    const users = loadUsers();
    const user = users.find((u) => String(u.open_id) === String(open_id));
    if (!user) return res.status(404).json({ error: "not_found" });
    return res.json({ ok: true, profile: user });
  } catch (err) {
    console.error("profile get error:", err);
    return res.status(500).json({ error: "internal_server_error", message: String(err) });
  }
});

// create or update (POST /api/profile)
router.post("/", (req, res) => {
  try {
    const body = req.body || {};
    const open_id = body.open_id || (body.raw && body.raw.data && body.raw.data.open_id);
    if (!open_id) return res.status(400).json({ error: "Missing open_id" });

    const users = loadUsers();
    let user = users.find(u => String(u.open_id) === String(open_id));

    const cleanedNick = (body.nickname !== undefined) ? cleanNick(body.nickname) : undefined;

    if (!user) {
      user = {
        open_id,
        // store nickname WITHOUT leading @
        nickname: cleanedNick ? cleanedNick : String(open_id),
        nickname_lower: cleanedNick ? cleanedNick.toLowerCase() : null,
        avatar: body.avatar || body.pfp || null,
        wins: Number.isFinite(body.wins) ? parseInt(body.wins, 10) : 0,
        losses: Number.isFinite(body.losses) ? parseInt(body.losses, 10) : 0,
        draws: Number.isFinite(body.draws) ? parseInt(body.draws, 10) : 0,
        level: Number.isFinite(body.level) ? parseInt(body.level, 10) : 1,
        deck: Array.isArray(body.deck) ? body.deck : [],
        created_at: Date.now(),
        updated_at: Date.now(),
      };
      // ensure nickname_lower present
      user.nickname_lower = user.nickname ? user.nickname.toLowerCase() : null;
      users.push(user);
    } else {
      if (cleanedNick !== undefined && cleanedNick !== null) {
        user.nickname = cleanedNick;
        user.nickname_lower = cleanedNick.toLowerCase();
      }
      if (body.avatar !== undefined) user.avatar = body.avatar;
      if (body.wins !== undefined) user.wins = Number.isFinite(body.wins) ? parseInt(body.wins, 10) : user.wins;
      if (body.losses !== undefined) user.losses = Number.isFinite(body.losses) ? parseInt(body.losses, 10) : user.losses;
      if (body.draws !== undefined) user.draws = Number.isFinite(body.draws) ? parseInt(body.draws, 10) : (user.draws || 0);
      else user.draws = Number.isFinite(user.draws) ? user.draws : 0;
      if (body.level !== undefined) user.level = Number.isFinite(body.level) ? parseInt(body.level, 10) : user.level;
      if (body.deck !== undefined) user.deck = Array.isArray(body.deck) ? body.deck : user.deck;
      user.updated_at = Date.now();
    }

    saveUsers(users);
    return res.json({ ok: true, profile: user });
  } catch (err) {
    console.error("profile post error:", err);
    return res.status(500).json({ error: "internal_server_error", message: String(err) });
  }
});

// delete by open_id
router.delete("/:open_id", (req, res) => {
  try {
    const { open_id } = req.params;
    const users = loadUsers();
    const filtered = users.filter((u) => String(u.open_id) !== String(open_id));
    if (filtered.length === users.length) return res.status(404).json({ error: "not_found" });
    saveUsers(filtered);
    return res.json({ ok: true });
  } catch (err) {
    console.error("profile delete error:", err);
    return res.status(500).json({ error: "internal_server_error", message: String(err) });
  }
});

export default router;
