// api/profile/index.js  (serverless handler)
import { getFirestore } from "../../server/lib/firestore.js"; // adjust path if needed

const COLLECTION = "profiles";

function normalizeNickname(n) {
  if (!n) return n;
  let s = String(n).trim();
  if (s.startsWith("@")) s = s.slice(1);
  return "@" + s;
}

export default async function handler(req, res) {
  try {
    const db = getFirestore();

    // CORS / preflight
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,DELETE,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    if (req.method === "OPTIONS") return res.status(204).end();

    if (req.method === "GET") {
      const open_id = req.query && req.query.open_id;
      if (open_id) {
        const doc = await db.collection(COLLECTION).doc(String(open_id)).get();
        if (!doc.exists) return res.status(404).json({ error: "not_found" });
        return res.json({ ok: true, profile: doc.data() });
      }
      // list all (careful on prod - pagination recommended)
      const snap = await db.collection(COLLECTION).limit(1000).get();
      const profiles = snap.docs.map(d => d.data());
      return res.json({ ok: true, profiles });
    }

    if (req.method === "POST") {
      const payload = (req.body && Object.keys(req.body).length ? req.body : {});
      const { open_id, nickname, avatar, wins, losses, level, deck } = payload;
      if (!open_id) return res.status(400).json({ error: "Missing open_id" });

      const ref = db.collection(COLLECTION).doc(String(open_id));
      const snap = await ref.get();
      const now = Date.now();

      if (!snap.exists) {
        const doc = {
          open_id,
          nickname: nickname ? normalizeNickname(nickname) : `@${open_id}`,
          avatar: avatar || null,
          wins: Number.isFinite(wins) ? Number(wins) : 0,
          losses: Number.isFinite(losses) ? Number(losses) : 0,
          level: Number.isFinite(level) ? Number(level) : 1,
          deck: Array.isArray(deck) ? deck : [],
          created_at: now,
          updated_at: now,
        };
        await ref.set(doc);
        return res.json({ ok: true, profile: doc });
      } else {
        const data = snap.data();
        const updated = {
          ...data,
          updated_at: now,
        };
        if (nickname !== undefined && nickname !== null) updated.nickname = normalizeNickname(nickname);
        if (avatar !== undefined) updated.avatar = avatar;
        if (wins !== undefined) updated.wins = Number.isFinite(wins) ? Number(wins) : data.wins;
        if (losses !== undefined) updated.losses = Number.isFinite(losses) ? Number(losses) : data.losses;
        if (level !== undefined) updated.level = Number.isFinite(level) ? Number(level) : data.level;
        if (deck !== undefined) updated.deck = Array.isArray(deck) ? deck : data.deck;

        await ref.set(updated, { merge: true });
        return res.json({ ok: true, profile: updated });
      }
    }

    if (req.method === "DELETE") {
      const open_id = req.query && req.query.open_id;
      if (!open_id) return res.status(400).json({ error: "Missing open_id" });
      await getFirestore().collection(COLLECTION).doc(String(open_id)).delete();
      return res.json({ ok: true });
    }

    res.setHeader("Allow", "GET,POST,DELETE,OPTIONS");
    return res.status(405).json({ error: "method_not_allowed" });
  } catch (err) {
    console.error("/api/profile error:", err && (err.stack || err));
    return res.status(500).json({ error: "internal_server_error", message: String(err) });
  }
}
