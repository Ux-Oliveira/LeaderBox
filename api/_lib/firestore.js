// api/_lib/firestore.js
import admin from "firebase-admin";
import fs from "fs";
import os from "os";
import path from "path";

function initFirebase() {
  if (admin.apps.length) return admin.firestore();

  const saJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
  if (saJson) {
    const keyPath = path.join(os.tmpdir(), `firebase_sa_${process.pid}.json`);
    fs.writeFileSync(keyPath, saJson, "utf8");
    process.env.GOOGLE_APPLICATION_CREDENTIALS = keyPath;
  }

  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
  });

  return admin.firestore();
}

export function getFirestore() {
  return initFirebase();
}
