// scripts/add-nickname-lower-to-firestore.js
import { getFirestore } from "../server/lib/firestore.js";

async function run() {
  const db = getFirestore();
  const col = db.collection("profiles");
  const snap = await col.get();
  console.log("Docs to update:", snap.size);
  const batch = db.batch();
  let count = 0;
  snap.forEach(doc => {
    const data = doc.data();
    const nick = (data.nickname || "").toString().replace(/^@+/, "");
    const lower = nick ? nick.toLowerCase() : null;
    if (lower && data.nickname_lower !== lower) {
      batch.update(doc.ref, { nickname: nick, nickname_lower: lower });
      count++;
    }
  });
  if (count > 0) {
    await batch.commit();
    console.log("Updated", count, "docs with nickname_lower");
  } else {
    console.log("Nothing to update");
  }
}
run().catch(e => { console.error(e); process.exit(2); });
