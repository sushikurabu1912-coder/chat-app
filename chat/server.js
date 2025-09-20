const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const multer = require("multer");
const path = require("path");
const urlMetadata = require("url-metadata");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, "public")));

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname),
});
const upload = multer({ storage });
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// URLプレビュー
app.get("/preview", async (req, res) => {
  const targetUrl = req.query.url;
  if (!targetUrl) return res.status(400).json({ error: "URL required" });
  try {
    const metadata = await urlMetadata(targetUrl);
    res.json({
      title: metadata.title || "",
      description: metadata.description || "",
      image: metadata.image || "",
      url: targetUrl,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch metadata" });
  }
});

// ファイルアップロード
app.post("/upload", upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file" });
  res.json({ url: `/uploads/${req.file.filename}`, type: req.file.mimetype });
});

// Socket.IO
let users = {};

io.on("connection", (socket) => {
  console.log("ユーザー接続:", socket.id);

  socket.on("setProfile", ({ name, avatar }) => {
    users[socket.id] = { name, avatar, online: true };
    io.emit("updateUsers", users);
  });

  socket.on("chat message", ({ msg, timestamp, file }) => {
    const user = users[socket.id] || { name: "名無し", avatar: "" };
    io.emit("chat message", {
      id: socket.id,
      name: user.name,
      avatar: user.avatar,
      msg,
      timestamp,
      file,
    });
  });

  // WebRTC
  socket.on("call", (data) => io.to(data.to).emit("call", { from: socket.id, offer: data.offer }));
  socket.on("answer", (data) => io.to(data.to).emit("answer", { from: socket.id, answer: data.answer }));
  socket.on("ice-candidate", (data) => io.to(data.to).emit("ice-candidate", { from: socket.id, candidate: data.candidate }));

  socket.on("disconnect", () => {
    console.log("ユーザー切断:", socket.id);
    delete users[socket.id];
    io.emit("updateUsers", users);
  });
});

server.listen(PORT, () => console.log(`✅ Server running on http://localhost:${PORT}`));
