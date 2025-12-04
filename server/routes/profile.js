// server/routes/profile.js
import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Put users.json in server/data/users.json (deterministic, not process.cwd())
const DATA_DIR = path.join(__dirname, "..", "data");
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

// Helpful startup log so you can confirm which file is used
console.log("[profile-route] USING USERS_PATH =", USERS_PATH);

/**
 * GET /api/profile           -> list all
 * GET /api/profile/:open_id  -> single profile
 * POST /api/profile          -> create or update (body JSON)  (keeps nickname if present)
 * POST /api/profile/complete -> set nickname + avatar (only if not already set; enforces uniqueness)
 * DELETE /api/profile/:open_id -> delete (admin or user)
 */

// list all
router.get("/", (req, res) => {
  try {
    const users = loadUsers();
    return res.json({ ok: true, profiles: users });
  } catch (err) {
    console.error("profile list error:", err);
    return res.status(500).json({ error: "internal_server_error", message: String(err) });
  }
});

// single
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

// create or update (safe — will not forcibly change nickname if already set)
router.post("/", (req, res) => {
  try {
    const { open_id, nickname, avatar, wins, losses, level, deck } = req.body || {};
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
      // do not allow changing nickname via this endpoint if it's already a custom @name
      if (nickname !== undefined && (!user.nickname || String(user.nickname).startsWith("@") === false)) {
        user.nickname = nickname;
      }
      // allow avatar update via this endpoint
      if (avatar !== undefined) user.avatar = avatar;
      if (wins !== undefined) user.wins = Number.isFinite(wins) ? parseInt(wins, 10) : user.wins;
      if (losses !== undefined) user.losses = Number.isFinite(losses) ? parseInt(losses, 10) : user.losses;
      if (level !== undefined) user.level = Number.isFinite(level) ? parseInt(level, 10) : user.level;
      if (deck !== undefined) user.deck = Array.isArray(deck) ? deck : user.deck;
      user.updated_at = Date.now();
    }

    saveUsers(users);
    return res.json({ ok: true, profile: user });
  } catch (err) {
    console.error("profile post error:", err);
    return res.status(500).json({ error: "internal_server_error", message: String(err) });
  }
});

/**
 * POST /api/profile/complete
 * Body: { open_id, nickname, avatar }
 * - nickname must be unique (case-insensitive),
 * - nickname will be stored as `@nickname` (leading @ enforced),
 * - only allowed if this user's nickname hasn't been set to a custom @name already.
 */
router.post("/complete", (req, res) => {
  try {
    const { open_id, nickname: rawNickname, avatar } = req.body || {};
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
});

// delete
router.delete("/:open_id", (req, res) => {
  try {
    const { open_id } = req.params;
    const users = loadUsers();
    const filtered = users.filter((u) => u.open_id !== open_id);
    if (filtered.length === users.length) return res.status(404).json({ error: "not_found" });
    saveUsers(filtered);
    return res.json({ ok: true });
  } catch (err) {
    console.error("profile delete error:", err);
    return res.status(500).json({ error: "internal_server_error", message: String(err) });
  }
});

export default router;
