// api/profile/index.js  (serverless handler - Firestore)
import { getFirestore } from "../../server/lib/firestore.js"; // keep your path
const COLLECTION = "profiles";

/**
 * Normalize nickname for saving (no leading @). Accepts empty-string as valid.
 */
function normalizeNicknameForSave(n) {
  if (n === undefined || n === null) return null;
  return String(n).trim().replace(/^@+/, "");
}

/**
 * Normalize for querying (lowercase, no @). Returns null when input missing.
 */
function normalizeNicknameForQuery(n) {
  const cleaned = normalizeNicknameForSave(n);
  return cleaned ? cleaned.toLowerCase() : null;
}

export default async function handler(req, res) {
  try {
    const db = getFirestore();

    // CORS / preflight
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,DELETE,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    if (req.method === "OPTIONS") return res.status(204).end();

    // ----- GET -----
    if (req.method === "GET") {
      const open_id = req.query && req.query.open_id;
      const nickname = req.query && req.query.nickname;

      // GET by open_id (document id)
      if (open_id) {
        const docRef = db.collection(COLLECTION).doc(String(open_id));
        const doc = await docRef.get();
        if (!doc.exists) return res.status(404).json({ ok: false, error: "not_found" });
        return res.json({ ok: true, profile: doc.data() });
      }

      // GET by nickname (case-insensitive) using nickname_lower field
      if (nickname) {
        const slug = normalizeNicknameForQuery(nickname);
        if (slug) {
          const snap = await db.collection(COLLECTION).where("nickname_lower", "==", slug).limit(1).get();
          if (!snap.empty) {
            const doc = snap.docs[0].data();
            return res.json({ ok: true, profile: doc });
          }
          // fallback: try exact nickname field (if nickname_lower missing)
          const snap2 = await db.collection(COLLECTION).where("nickname", "==", normalizeNicknameForSave(nickname)).limit(1).get();
          if (!snap2.empty) {
            return res.json({ ok: true, profile: snap2.docs[0].data() });
          }
          return res.status(404).json({ ok: false, error: "not_found" });
        } else {
          return res.status(400).json({ ok: false, error: "invalid_nickname" });
        }
      }

      // list all (careful on prod - pagination recommended)
      const snap = await db.collection(COLLECTION).limit(1000).get();
      const profiles = snap.docs.map(d => d.data());
      return res.json({ ok: true, profiles });
    }

    // ----- POST (create or update by open_id) -----
    if (req.method === "POST") {
      const payload = (req.body && Object.keys(req.body).length ? req.body : {});
      const { open_id, nickname, avatar, wins, losses, level, deck } = payload;
      if (!open_id) return res.status(400).json({ error: "Missing open_id" });

      const ref = db.collection(COLLECTION).doc(String(open_id));
      const snap = await ref.get();
      const now = Date.now();

      // normalize nickname without @ and store lowercase helper for searches
      const cleaned = normalizeNicknameForSave(nickname);
      const cleanedLower = cleaned ? cleaned.toLowerCase() : null;

      if (!snap.exists) {
        const doc = {
          open_id: String(open_id),
          // store nickname WITHOUT leading @; if none provided use open_id as fallback
          nickname: cleaned ? cleaned : String(open_id),
          nickname_lower: cleanedLower,
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
        if (nickname !== undefined && nickname !== null) {
          updated.nickname = cleaned ? cleaned : String(open_id);
          updated.nickname_lower = cleanedLower;
        }
        if (avatar !== undefined) updated.avatar = avatar;
        if (wins !== undefined) updated.wins = Number.isFinite(wins) ? Number(wins) : data.wins;
        if (losses !== undefined) updated.losses = Number.isFinite(losses) ? Number(losses) : data.losses;
        if (level !== undefined) updated.level = Number.isFinite(level) ? Number(level) : data.level;
        if (deck !== undefined) updated.deck = Array.isArray(deck) ? deck : data.deck;

        await ref.set(updated, { merge: true });
        return res.json({ ok: true, profile: updated });
      }
    }

    // ----- DELETE -----
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
