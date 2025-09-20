const socket = io();
let myProfile = { name: "", icon: "" };

// UI要素
const nameInput = document.getElementById("nameInput");
const iconInput = document.getElementById("iconInput");
const registerBtn = document.getElementById("registerBtn");
const usersDiv = document.getElementById("users");
const chatInput = document.getElementById("chatInput");
const sendBtn = document.getElementById("sendBtn");
const messages = document.getElementById("messages");
const fileInput = document.getElementById("fileInput");
const sendFileBtn = document.getElementById("sendFileBtn");

// タイムスタンプ
function getTimeStamp() {
  const now = new Date();
  return `${now.getMonth() + 1}/${now.getDate()} ${now.getHours()}:${now.getMinutes().toString().padStart(2, "0")}`;
}

// プロフィール登録
registerBtn.onclick = async () => {
  const name = nameInput.value.trim();
  if (!name) return;

  let iconUrl = "";
  if (iconInput.files.length > 0) {
    const formData = new FormData();
    formData.append("icon", iconInput.files[0]);
    const res = await fetch("/upload", { method: "POST", body: formData });
    const data = await res.json();
    iconUrl = data.url;
  }

  myProfile = { name, icon: iconUrl };
  socket.emit("register", myProfile);
};

// オンラインユーザー表示
socket.on("online-users", (users) => {
  usersDiv.innerHTML = "";
  for (const [id, user] of Object.entries(users)) {
    const div = document.createElement("div");
    const status = document.createElement("span");
    status.style.width = "10px";
    status.style.height = "10px";
    status.style.borderRadius = "50%";
    status.style.backgroundColor = user.status === "online" ? "green" : "gray";
    status.style.marginRight = "5px";

    const img = document.createElement("img");
    img.src = user.icon || "/default_icon.png";
    img.width = 24; img.height = 24;

    const span = document.createElement("span");
    span.textContent = user.name + (id === socket.id ? " (自分)" : "");

    div.appendChild(status);
    div.appendChild(img);
    div.appendChild(span);
    div.style.display = "flex";
    div.style.alignItems = "center";
    div.style.marginBottom = "5px";

    usersDiv.appendChild(div);
  }
});

// メッセージ送信
sendBtn.onclick = () => {
  if (!chatInput.value.trim()) return;
  const timestamp = getTimeStamp();
  const msgData = { profile: myProfile, msg: chatInput.value, timestamp };
  socket.emit("chat message", msgData);
  appendMessage(msgData.profile, msgData, timestamp);
  chatInput.value = "";
};

// ファイル送信
sendFileBtn.onclick = async () => {
  if (fileInput.files.length === 0) return;
  const formData = new FormData();
  formData.append("file", fileInput.files[0]);
  const res = await fetch("/chat-upload", { method: "POST", body: formData });
  const data = await res.json();
  const timestamp = getTimeStamp();
  const msgData = { profile: myProfile, msg: "", timestamp, file: data };
  socket.emit("chat message", msgData);
  appendMessage(msgData.profile, msgData, timestamp);
  fileInput.value = "";
};

// メッセージ受信
socket.on("chat message", (msgData) => {
  appendMessage(msgData.profile, msgData, msgData.timestamp);
});

// Discord風のメッセージ描画
function appendMessage(profile, msgData, timestamp) {
  const li = document.createElement("li");
  li.className = "message";

  const icon = document.createElement("img");
  icon.src = profile.icon || "/default_icon.png";
  icon.className = "message-icon";

  const content = document.createElement("div");
  content.className = "message-content";

  const header = document.createElement("div");
  header.className = "message-header";
  header.innerHTML = `<span class="message-username">${profile.name}</span> ${timestamp}`;
  content.appendChild(header);

  if (msgData.msg) {
    const textNode = document.createElement("div");
    textNode.className = "message-text";
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    textNode.innerHTML = msgData.msg.replace(urlRegex, (url) => `<a href="${url}" target="_blank">${url}</a>`);
    content.appendChild(textNode);
  }

  if (msgData.file) {
    const file = msgData.file;
    const ext = file.name.split(".").pop().toLowerCase();
    const attach = document.createElement("div");
    attach.className = "message-attachment";

    if (["png","jpg","jpeg","gif","webp"].includes(ext)) {
      const img = document.createElement("img");
      img.src = file.url;
      attach.appendChild(img);
    } else if (["mp4","webm","ogg"].includes(ext)) {
      const video = document.createElement("video");
      video.src = file.url;
      video.controls = true;
      attach.appendChild(video);
    } else if (["mp3","wav","ogg"].includes(ext)) {
      const audio = document.createElement("audio");
      audio.src = file.url;
      audio.controls = true;
      attach.appendChild(audio);
    } else {
      const link = document.createElement("a");
      link.href = file.url;
      link.textContent = `📎 ${file.name}`;
      link.target = "_blank";
      attach.appendChild(link);
    }
    content.appendChild(attach);
  }

  if (msgData.preview) {
    const card = document.createElement("a");
    card.href = msgData.preview.url;
    card.target = "_blank";
    card.className = "preview-card";

    if (msgData.preview.image) {
      const img = document.createElement("img");
      img.src = msgData.preview.image;
      card.appendChild(img);
    }
    const info = document.createElement("div");
    info.innerHTML = `<strong>${msgData.preview.title}</strong><br/><small>${msgData.preview.description}</small>`;
    card.appendChild(info);

    content.appendChild(card);
  }

  li.appendChild(icon);
  li.appendChild(content);
  messages.appendChild(li);
  messages.scrollTop = messages.scrollHeight;
}
