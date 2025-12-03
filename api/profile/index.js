// api/profile/index.js
import fs from "fs";
import path from "path";
import { promisify } from "util";

const DATA_DIR = path.resolve("./data");
const USERS_PATH = path.join(DATA_DIR, "users.json");

const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);
const mkdir = promisify(fs.mkdir);

async function ensureDataFile() {
  try {
    if (!fs.existsSync(DATA_DIR)) await mkdir(DATA_DIR, { recursive: true });
    if (!fs.existsSync(USERS_PATH)) await writeFile(USERS_PATH, "[]", "utf8");
  } catch (e) {
    console.error("ensureDataFile error:", e);
    throw e;
  }
}

async function loadUsers() {
  await ensureDataFile();
  try {
    const raw = await readFile(USERS_PATH, "utf8");
    return JSON.parse(raw || "[]");
  } catch (e) {
    console.warn("Failed to read users.json:", e);
    return [];
  }
}

async function saveUsers(users) {
  await ensureDataFile();
  const tmp = USERS_PATH + ".tmp";
  await writeFile(tmp, JSON.stringify(users, null, 2), "utf8");
  await fs.promises.rename(tmp, USERS_PATH);
}

// Helper robust body parser for platforms where req.body may not be present
async function readJsonBody(req) {
  if (req.body && Object.keys(req.body).length) return req.body;
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => {
      if (!data) return resolve({});
      try {
        resolve(JSON.parse(data));
      } catch (e) {
        // fallback to URLSearchParams parsing
        try {
          const params = new URLSearchParams(data);
          const obj = {};
          for (const [k, v] of params.entries()) obj[k] = v;
          resolve(obj);
        } catch (e2) {
          reject(e);
        }
      }
    });
    req.on("error", reject);
  });
}

export default async function handler(req, res) {
  // CORS for browser calls (adjust origin in production if needed)
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  try {
    console.log("[api/profile] incoming:", req.method, req.url);

    const method = req.method;
    if (method === "GET") {
      const q = req.query || {};
      const open_id = q.open_id || q.openId || null;
      const users = await loadUsers();
      if (open_id) {
        const user = users.find((u) => String(u.open_id) === String(open_id));
        if (!user) return res.status(404).json({ error: "not_found" });
        return res.json({ ok: true, profile: user });
      }
      return res.json({ ok: true, profiles: users });
    }

    if (method === "POST") {
      const body = await readJsonBody(req);
      console.log("[api/profile] POST body:", JSON.stringify(body).slice(0, 2000));
      const { open_id, nickname, avatar, wins, losses, level, deck, raw } = body || {};

      if (!open_id) return res.status(400).json({ error: "Missing open_id" });

      const users = await loadUsers();
      let user = users.find((u) => String(u.open_id) === String(open_id));

      // detect possible avatar in nested vendor response (robust fallback)
      const detectedAvatar = avatar
        || (body.pfp)
        || (raw && raw.data && raw.data.user && (raw.data.user.avatar_large || raw.data.user.avatar))
        || (raw && raw.data && raw.data.avatar)
        || null;

      if (!user) {
        user = {
          open_id: String(open_id),
          nickname: nickname || (raw && raw.data && raw.data.user && (raw.data.user.display_name)) || `@${open_id}`,
          avatar: detectedAvatar,
          wins: Number.isFinite(wins) ? parseInt(wins, 10) : 0,
          losses: Number.isFinite(losses) ? parseInt(losses, 10) : 0,
          level: Number.isFinite(level) ? parseInt(level, 10) : 1,
          deck: Array.isArray(deck) ? deck : [],
          created_at: Date.now(),
          updated_at: Date.now(),
          raw: raw || null,
        };
        users.push(user);
      } else {
        if (nickname !== undefined) user.nickname = nickname;
        if (avatar !== undefined) user.avatar = avatar;
        if (detectedAvatar && !user.avatar) user.avatar = detectedAvatar;
        if (wins !== undefined) user.wins = Number.isFinite(wins) ? parseInt(wins, 10) : user.wins;
        if (losses !== undefined) user.losses = Number.isFinite(losses) ? parseInt(losses, 10) : user.losses;
        if (level !== undefined) user.level = Number.isFinite(level) ? parseInt(level, 10) : user.level;
        if (deck !== undefined) user.deck = Array.isArray(deck) ? deck : user.deck;
        user.updated_at = Date.now();
        if (raw) user.raw = raw;
      }

      await saveUsers(users);
      console.log("[api/profile] saved profile open_id=", user.open_id, "avatar:", Boolean(user.avatar));
      return res.json({ ok: true, profile: user });
    }

    if (method === "DELETE") {
      const q = req.query || {};
      const open_id = q.open_id || q.openId || null;
      if (!open_id) return res.status(400).json({ error: "Missing open_id" });
      const users = await loadUsers();
      const filtered = users.filter((u) => String(u.open_id) !== String(open_id));
      if (filtered.length === users.length) return res.status(404).json({ error: "not_found" });
      await saveUsers(filtered);
      return res.json({ ok: true });
    }

    res.setHeader("Allow", "GET,POST,DELETE,OPTIONS");
    return res.status(405).json({ error: "method_not_allowed" });
  } catch (err) {
    console.error("[api/profile] ERROR", err && (err.stack || err));
    return res.status(500).json({ error: "internal_server_error", message: String(err) });
  }
}
