const express = require("express");
const fs = require("fs");
const path = require("path");

const router = express.Router();
const USERS_PATH = path.join(__dirname, "..", "users.json");

function loadUsers() {
  return JSON.parse(fs.readFileSync(USERS_PATH, "utf8"));
}

function saveUsers(users) {
  fs.writeFileSync(USERS_PATH, JSON.stringify(users, null, 2));
}

router.post("/", (req, res) => {
  const { open_id, nickname, avatar } = req.body;

  let users = loadUsers();
  let user = users.find(u => u.open_id === open_id);

  if (!user) {
    user = {
      open_id,
      nickname,
      avatar,
      wins: 0,
      losses: 0,
      level: 1,
      deck: [],
    };
    users.push(user);
  } else {
    // Update only TikTok info
    user.nickname = nickname;
    user.avatar = avatar;
  }

  saveUsers(users);
  res.json(user);
});

module.exports = router;
