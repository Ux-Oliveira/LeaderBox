// scripts/add-draws-to-users.js
import fs from "fs";
import path from "path";

const DATA = path.resolve("./server/data/users.json");
if (!fs.existsSync(DATA)) {
  console.error("No users.json to normalize:", DATA);
  process.exit(1);
}
const raw = fs.readFileSync(DATA, "utf8");
let users = [];
try { users = JSON.parse(raw || "[]"); } catch (e) { console.error("parse error", e); process.exit(2); }

let changed = 0;
users = users.map(u => {
  const copy = { ...u };
  if (!Number.isFinite(copy.draws)) {
    copy.draws = 0;
    changed++;
  }
  return copy;
});

fs.writeFileSync(DATA, JSON.stringify(users, null, 2), "utf8");
console.log("Normalized draws for", users.length, "users. Added draws to", changed, "users.");
