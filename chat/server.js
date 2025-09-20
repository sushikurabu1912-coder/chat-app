import express from "express";
import http from "http";
import { Server } from "socket.io";
import multer from "multer";
import fetch from "node-fetch";
import * as cheerio from "cheerio";
import path from "path";

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const upload = multer({ dest: "uploads/" });
app.use("/uploads", express.static("uploads"));
app.use(express.static("public"));

let onlineUsers = {};

// OGP取得関数
async function fetchOGP(url) {
  try {
    const res = await fetch(url);
    const html = await res.text();
    const $ = cheerio.load(html);

    return {
      title: $('meta[property="og:title"]').attr("content") || $("title").text(),
      description: $('meta[property="og:description"]').attr("content") || "",
      image: $('meta[property="og:image"]').attr("content") || "",
      url,
    };
  } catch (err) {
    console.error("OGP取得失敗:", err);
    return { title: url, description: "", image: "", url };
  }
}

// プロフィール用アイコンアップロード
app.post("/upload", upload.single("icon"), (req, res) => {
  res.json({ url: `/uploads/${req.file.filename}` });
});

// チャット用ファイルアップロード
app.post("/chat-upload", upload.single("file"), (req, res) => {
  res.json({ url: `/uploads/${req.file.filename}`, name: req.file.originalname });
});

// ソケット通信
io.on("connection", (socket) => {
  console.log("user connected:", socket.id);

  socket.on("register", (profile) => {
    onlineUsers[socket.id] = { ...profile, status: "online" };
    io.emit("online-users", onlineUsers);
  });

  socket.on("chat message", async (msgData) => {
    // URL検出 & OGPプレビュー
    const urlRegex = /(https?:\/\/[^\s]+)/;
    const match = msgData.msg.match(urlRegex);
    if (match) {
      msgData.preview = await fetchOGP(match[0]);
    }
    io.emit("chat message", msgData);
  });

  // WebRTCシグナリング
  socket.on("offer", (data) => io.to(data.to).emit("offer", { from: socket.id, sdp: data.sdp }));
  socket.on("answer", (data) => io.to(data.to).emit("answer", { from: socket.id, sdp: data.sdp }));
  socket.on("candidate", (data) =>
    io.to(data.to).emit("candidate", { from: socket.id, candidate: data.candidate })
  );

  socket.on("disconnect", () => {
    if (onlineUsers[socket.id]) {
      delete onlineUsers[socket.id];
      io.emit("online-users", onlineUsers);
    }
  });
});

server.listen(3000, () => console.log("Server running on http://localhost:3000"));
