const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const multer = require('multer');
const path = require('path');
const axios = require('axios');
const cheerio = require('cheerio');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const upload = multer({ dest: 'public/uploads/' });
const onlineUsers = {};

app.use(express.static('public'));

// アイコンアップロード
app.post('/upload', upload.single('icon'), (req, res) => {
  res.json({ url: `/uploads/${req.file.filename}` });
});

// チャットファイルアップロード
app.post('/chat-upload', upload.single('file'), (req, res) => {
  res.json({ url: `/uploads/${req.file.filename}`, name: req.file.originalname });
});

// URLプレビュー取得
app.get('/url-preview', async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'URL required' });
  try {
    const response = await axios.get(url);
    const $ = cheerio.load(response.data);
    const title = $('meta[property="og:title"]').attr('content') || $('title').text();
    const description = $('meta[property="og:description"]').attr('content') || '';
    const image = $('meta[property="og:image"]').attr('content') || '';
    res.json({ title, description, image, url });
  } catch {
    res.json({ title: url, description: '', image: '', url });
  }
});

io.on('connection', (socket) => {
  socket.on('register', (data) => {
    onlineUsers[socket.id] = { ...data, status: 'online' };
    io.emit('online-users', onlineUsers);
  });

  socket.on('chat message', (msg) => io.emit('chat message', msg));
  socket.on('typing', (isTyping) => socket.broadcast.emit('typing', { id: socket.id, isTyping }));

  // WebRTCシグナリング
  socket.on('webrtc-offer', (data) => io.to(data.target).emit('webrtc-offer', { from: socket.id, sdp: data.sdp }));
  socket.on('webrtc-answer', (data) => io.to(data.target).emit('webrtc-answer', { from: socket.id, sdp: data.sdp }));
  socket.on('webrtc-candidate', (data) => io.to(data.target).emit('webrtc-candidate', { from: socket.id, candidate: data.candidate }));

  socket.on('disconnect', () => {
    delete onlineUsers[socket.id];
    io.emit('online-users', onlineUsers);
  });
});

// Render環境のPORTを使用
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
