import fs from "fs";
import path from "path";

const root = path.resolve("./server/users.json");
const data = path.resolve("./server/data/users.json");

function read(file) {
  if (!fs.existsSync(file)) return [];
  try { return JSON.parse(fs.readFileSync(file, "utf8") || "[]"); } catch (e) { console.error("Failed parsing", file, e); return []; }
}

const a = read(root);
const b = read(data);

// merge: prefer b when same open_id exists
const map = new Map();
a.forEach(u => { if (u?.open_id) map.set(String(u.open_id), u); });
b.forEach(u => { if (u?.open_id) map.set(String(u.open_id), u); });

const merged = Array.from(map.values());
fs.mkdirSync(path.dirname(data), { recursive: true });
fs.writeFileSync(data, JSON.stringify(merged, null, 2), "utf8");

console.log("Migrated ->", data, "count=", merged.length);
