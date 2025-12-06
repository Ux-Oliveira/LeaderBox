// scripts/migrate-users-to-firestore.js
import fs from "fs";
import path from "path";
import { getFirestore } from "../server/lib/firestore.js";

async function migrate() {
  const file = path.resolve("./server/data/users.json");
  if (!fs.existsSync(file)) {
    console.error("users.json missing:", file);
    process.exit(1);
  }
  const raw = fs.readFileSync(file, "utf8");
  const users = JSON.parse(raw || "[]");
  if (!Array.isArray(users)) {
    console.error("users.json not array");
    process.exit(1);
  }
  const db = getFirestore();
  const batch = db.batch();
  for (const u of users) {
    if (!u || !u.open_id) continue;
    const ref = db.collection("profiles").doc(String(u.open_id));
    const doc = { ...u, updated_at: u.updated_at || Date.now(), created_at: u.created_at || Date.now() };
    batch.set(ref, doc, { merge: true });
  }
  await batch.commit();
  console.log("Migrated", users.length, "users -> Firestore profiles collection");
  process.exit(0);
}

migrate().catch(e => { console.error(e); process.exit(2); });
