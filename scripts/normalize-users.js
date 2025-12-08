import fs from "fs";
import path from "path";

const DATA = path.resolve("./server/data/users.json");
if (!fs.existsSync(DATA)) {
  console.log("No users.json to normalize:", DATA);
  process.exit(0);
}
const raw = fs.readFileSync(DATA, "utf8");
let users = [];
try { users = JSON.parse(raw || "[]"); } catch (e) { console.error("parse error", e); process.exit(2); }

function clean(n) {
  if (!n && n !== "") return null;
  return String(n).trim().replace(/^@+/, "");
}

users = users.map(u => {
  const copy = { ...u };
  copy.nickname = clean(u.nickname) || (u.open_id ? String(u.open_id) : null);
  return copy;
});

fs.writeFileSync(DATA, JSON.stringify(users, null, 2), "utf8");
console.log("Normalized", users.length, "users ->", DATA);
