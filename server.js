const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

let users = {};

io.on("connection", socket => {
  console.log("ユーザー接続:", socket.id);

  // プロフィール登録
  socket.on("set-profile", profile => {
    users[socket.id] = { ...profile, socketId: socket.id, status: "オンライン" };
    io.emit("users", users);
  });

  // メッセージ送信
  socket.on("send-message", msg => io.emit("receive-message", msg));

  // 入力中通知
  socket.on("typing", data => socket.broadcast.emit("typing", data));

  // 通話
  socket.on("call-user", ({ target, from }) => {
    const targetUser = Object.values(users).find(u => u.username === target);
    if (targetUser && targetUser.status === "オンライン") {
      io.to(targetUser.socketId).emit("incoming-call", { from });
    }
  });

  socket.on("call-accept", ({ from }) => {
    const caller = Object.values(users).find(u => u.username === from);
    if (caller) io.to(caller.socketId).emit("call-accepted", { by: users[socket.id].username });
  });

  socket.on("call-reject", ({ target }) => {
    const targetUser = Object.values(users).find(u => u.username === target);
    if (targetUser) io.to(targetUser.socketId).emit("call-rejected");
  });

  socket.on("disconnect", () => {
    delete users[socket.id];
    io.emit("users", users);
  });
});

// React ビルド配信
app.use(express.static(path.join(__dirname, "build")));
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "build", "index.html"));
});

server.listen(5000, () => console.log("Server running on 5000"));
