import { getProfileByOpenId, updateProfile } from "@/lib/db";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { winner, loser } = req.body;

  if (!winner || !loser) {
    return res.status(400).json({ error: "Missing winner or loser" });
  }

  try {
    const winnerProfile = await getProfileByOpenId(winner);
    const loserProfile = await getProfileByOpenId(loser);

    if (!winnerProfile || !loserProfile) {
      return res.status(404).json({ error: "Profile not found" });
    }

    await updateProfile(winner, {
      wins: (winnerProfile.wins || 0) + 1,
    });

    await updateProfile(loser, {
      losses: (loserProfile.losses || 0) + 1,
    });

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("Duel result error:", err);
    return res.status(500).json({ error: "Failed to save duel result" });
  }
}
