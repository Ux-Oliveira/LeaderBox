// scripts/add-draws-to-firestore.js
import { getFirestore } from "../server/lib/firestore.js";

async function run() {
  const db = getFirestore();
  const col = db.collection("profiles");
  const snap = await col.get();
  console.log("Docs:", snap.size);
  const batch = db.batch();
  let count = 0;
  snap.forEach(doc => {
    const data = doc.data();
    if (!Number.isFinite(data.draws)) {
      batch.update(doc.ref, { draws: 0 });
      count++;
    }
  });
  if (count > 0) {
    await batch.commit();
    console.log("Updated", count, "docs with draws=0");
  } else {
    console.log("Nothing to update");
  }
}
run().catch(e => { console.error(e); process.exit(2); });
