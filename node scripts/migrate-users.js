// scripts/migrate-users.js
import fs from "fs";
import path from "path";

const root = path.resolve("./users.json");
const data = path.resolve("./data/users.json");

function read(file) {
  if (!fs.existsSync(file)) return [];
  try { return JSON.parse(fs.readFileSync(file, "utf8") || "[]"); } catch (e) { console.error("Failed parsing", file, e); return []; }
}

const a = read(root);
const b = read(data);

// merge: prefer b (data) when same open_id exists; otherwise include from a
const map = new Map();
[a, b].flat().forEach(u => {
  if (!u || !u.open_id) return;
  const id = String(u.open_id);
  if (!map.has(id)) map.set(id, u);
  else {
    // if b (data) already present, prefer it; we ensure entries from b overwrite a by adding a first then b
    // but since we pushed a then b but here we check existence, we want b to overwrite:
    // so do nothing here (a already set), we will re-run inserting b afterwards
  }
});

// ensure b overwrites a
b.forEach(u => {
  if (u && u.open_id) map.set(String(u.open_id), u);
});

const merged = Array.from(map.values());
fs.mkdirSync(path.dirname(data), { recursive: true });
fs.writeFileSync(data, JSON.stringify(merged, null, 2), "utf8");
console.log("Migrated ->", data, "count=", merged.length);
