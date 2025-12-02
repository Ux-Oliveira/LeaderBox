// api/profile.js
import fs from "fs";
import path from "path";

const DATA_DIR = path.resolve(process.cwd(), "data");
const USERS_PATH = path.join(DATA_DIR, "users.json");

function ensureDataFile() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(USERS_PATH)) {
      fs.writeFileSync(USERS_PATH, "[]", "utf8");
    }
  } catch (e) {
    console.error("Failed to ensure data file:", e);
    throw e;
  }
}

function loadUsers() {
  ensureDataFile();
  try {
    const raw = fs.readFileSync(USERS_PATH, "utf8");
    return JSON.parse(raw || "[]");
  } catch (e) {
    console.warn("Failed to read users.json, returning []:", e);
    return [];
  }
}

function saveUsers(users) {
  ensureDataFile();
  const tmp = USERS_PATH + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(users, null, 2), "utf8");
  fs.renameSync(tmp, USERS_PATH);
}

/**
 * Vercel / Netlify style handler
 * Accepts:
 *  - GET /api/profile          -> list all
 *  - GET /api/profile?open_id=ID or GET /api/profile/:open_id  -> single (we support query param and path param)
 *  - POST /api/profile         -> create or update (body JSON)
 *  - DELETE /api/profile/:open_id -> delete
 */
export default async function handler(req, res) {
  try {
    const { method } = req;
    // Normalize path param (some platforms put it in req.query)
    // Try to get open_id from query param or from path (e.g. /api/profile/:open_id)
    const urlPath = (req.url || "").split("?")[0] || "";
    const pathParts = urlPath.split("/").filter(Boolean); // e.g. ["api","profile",":open_id"]
    const maybeId = pathParts.length >= 3 ? pathParts[2] : null;
    const queryOpenId = req.query && (req.query.open_id || req.query.id) ? (req.query.open_id || req.query.id) : null;
    const open_id = maybeId || queryOpenId;

    if (method === "GET") {
      if (open_id) {
        const users = loadUsers();
        const user = users.find((u) => String(u.open_id) === String(open_id));
        if (!user) return res.status(404).json({ error: "not_found" });
        return res.json({ ok: true, profile: user });
      } else {
        const users = loadUsers();
        return res.json({ ok: true, profiles: users });
      }
    }

    if (method === "POST") {
      const body = req.body || (req.method === "POST" ? await new Promise((r, rej) => {
        let data = "";
        req.on("data", (c) => (data += c));
        req.on("end", () => {
          try { r(data ? JSON.parse(data) : {}); } catch (e) { rej(e); }
        });
        req.on("error", rej);
      }) : {});
      const { open_id } = body;
      if (!open_id) return res.status(400).json({ error: "Missing open_id" });

      const users = loadUsers();
      let user = users.find((u) => u.open_id === open_id);

      if (!user) {
        user = {
          open_id,
          nickname: body.nickname || `@${open_id}`,
          avatar: body.avatar || null,
          wins: Number.isFinite(body.wins) ? parseInt(body.wins, 10) : 0,
          losses: Number.isFinite(body.losses) ? parseInt(body.losses, 10) : 0,
          level: Number.isFinite(body.level) ? parseInt(body.level, 10) : 1,
          deck: Array.isArray(body.deck) ? body.deck : [],
          created_at: Date.now(),
          updated_at: Date.now(),
        };
        users.push(user);
      } else {
        if (body.nickname !== undefined) user.nickname = body.nickname;
        if (body.avatar !== undefined) user.avatar = body.avatar;
        if (body.wins !== undefined) user.wins = Number.isFinite(body.wins) ? parseInt(body.wins, 10) : user.wins;
        if (body.losses !== undefined) user.losses = Number.isFinite(body.losses) ? parseInt(body.losses, 10) : user.losses;
        if (body.level !== undefined) user.level = Number.isFinite(body.level) ? parseInt(body.level, 10) : user.level;
        if (body.deck !== undefined) user.deck = Array.isArray(body.deck) ? body.deck : user.deck;
        user.updated_at = Date.now();
      }

      saveUsers(users);
      return res.json({ ok: true, profile: user });
    }

    if (method === "DELETE") {
      if (!open_id) return res.status(400).json({ error: "Missing open_id" });
      const users = loadUsers();
      const filtered = users.filter((u) => u.open_id !== open_id);
      if (filtered.length === users.length) return res.status(404).json({ error: "not_found" });
      saveUsers(filtered);
      return res.json({ ok: true });
    }

    // Method not allowed
    res.setHeader("Allow", "GET,POST,DELETE");
    return res.status(405).json({ error: "method_not_allowed" });
  } catch (err) {
    console.error("profile api error:", err);
    return res.status(500).json({ error: "internal_server_error", message: String(err) });
  }
}
