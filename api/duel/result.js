import { getFirestore } from "../_lib/firestore.js";

const COLLECTION = "profiles";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { winner, loser } = req.body;

  if (!winner || !loser) {
    return res.status(400).json({ error: "Missing winner or loser" });
  }

  try {
    const db = getFirestore();

    const winnerRef = db.collection(COLLECTION).doc(String(winner));
    const loserRef = db.collection(COLLECTION).doc(String(loser));

    const [winnerSnap, loserSnap] = await Promise.all([
      winnerRef.get(),
      loserRef.get(),
    ]);

    if (!winnerSnap.exists || !loserSnap.exists) {
      return res.status(404).json({ error: "Profile not found" });
    }

    const winnerData = winnerSnap.data();
    const loserData = loserSnap.data();

    await Promise.all([
      winnerRef.set(
        { wins: (winnerData.wins || 0) + 1, updated_at: Date.now() },
        { merge: true }
      ),
      loserRef.set(
        { losses: (loserData.losses || 0) + 1, updated_at: Date.now() },
        { merge: true }
      ),
    ]);

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("Duel result error:", err);
    return res.status(500).json({ error: "internal_server_error" });
  }
}
