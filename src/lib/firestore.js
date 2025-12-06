// server/lib/firestore.js
import admin from "firebase-admin";
import fs from "fs";
import os from "os";
import path from "path";

function initFirebase() {
  if (admin.apps && admin.apps.length) return admin.firestore();

  // Prefer service JSON from env var (sa JSON string) for Vercel
  const saJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
  if (saJson) {
    // write to a temp file so admin.initializeApp can load it
    const tmpDir = os.tmpdir();
    const keyPath = path.join(tmpDir, `firebase_sa_${process.pid}.json`);
    fs.writeFileSync(keyPath, saJson, "utf8");
    process.env.GOOGLE_APPLICATION_CREDENTIALS = keyPath;
  }

  // If GOOGLE_APPLICATION_CREDENTIALS is set and points to file, admin SDK will use it.
  try {
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
    });
  } catch (err) {
    // if already initialized, ignore
    if (!/already exists/.test(String(err))) console.error("initFirebase error:", err);
  }
  return admin.firestore();
}

export function getFirestore() {
  return initFirebase();
}
