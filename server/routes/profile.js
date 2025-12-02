// server/routes/profile.js
import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// routes is under server/, so users.json lives at server/users.json
const USERS_PATH = path.join(__dirname, "../users.json");

function loadUsers() {
  try {
    const raw = fs.readFileSync(USERS_PATH, "utf8");
    return JSON.parse(raw || "[]");
  } catch (e) {
    return [];
  }
}
function saveUsers(users) {
  // write atomically: temp file then rename (safer)
  const tmp = USERS_PATH + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(users, null, 2), { encoding: "utf8" });
  fs.renameSync(tmp, USERS_PATH);
}

const router = express.Router();

// List all profiles (GET /api/profile)
router.get("/", (req, res) => {
  const users = loadUsers();
  return res.json({ ok: true, profiles: users });
});

// Get single profile (GET /api/profile/:open_id)
router.get("/:open_id", (req, res) => {
  const { open_id } = req.params;
  const users = loadUsers();
  const user = users.find(u => u.open_id === open_id);
  if (!user) return res.status(404).json({ error: "not_found" });
  return res.json({ ok: true, profile: user });
});

// Create or update profile (POST /api/profile)
router.post("/", (req, res) => {
  try {
    const { open_id, nickname, avatar, wins, losses, level, deck } = req.body;
    if (!open_id) return res.status(400).json({ error: "Missing open_id" });

    const users = loadUsers();
    let user = users.find(u => u.open_id === open_id);

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
        updated_at: Date.now()
      };
      users.push(user);
    } else {
      // update allowed fields
      if (typeof nickname !== "undefined") user.nickname = nickname;
      if (typeof avatar !== "undefined") user.avatar = avatar;
      if (typeof wins !== "undefined") user.wins = Number.isFinite(wins) ? parseInt(wins, 10) : user.wins;
      if (typeof losses !== "undefined") user.losses = Number.isFinite(losses) ? parseInt(losses, 10) : user.losses;
      if (typeof level !== "undefined") user.level = Number.isFinite(level) ? parseInt(level, 10) : user.level;
      if (typeof deck !== "undefined") user.deck = Array.isArray(deck) ? deck : user.deck;
      user.updated_at = Date.now();
    }

    saveUsers(users);
    return res.json({ ok: true, profile: user });
  } catch (err) {
    console.error("profile route error:", err);
    return res.status(500).json({ error: "internal_server_error", message: String(err) });
  }
});

// Delete profile (DELETE /api/profile/:open_id)
router.delete("/:open_id", (req, res) => {
  try {
    const { open_id } = req.params;
    const users = loadUsers();
    const filtered = users.filter(u => u.open_id !== open_id);
    if (filtered.length === users.length) return res.status(404).json({ error: "not_found" });
    saveUsers(filtered);
    return res.json({ ok: true });
  } catch (err) {
    console.error("profile delete error:", err);
    return res.status(500).json({ error: "internal_server_error", message: String(err) });
  }
});

export default router;
