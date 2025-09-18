const socket = io();
let myProfile = { name: '', icon: '' };
let typingTimeout;
const typingUsers = {};

const nameInput = document.getElementById('nameInput');
const iconInput = document.getElementById('iconInput');
const registerBtn = document.getElementById('registerBtn');
const editProfileBtn = document.getElementById('editProfileBtn');
const usersDiv = document.getElementById('users');
const messages = document.getElementById('messages');
const typingStatus = document.getElementById('typingStatus');
const chatInput = document.getElementById('chatInput');
const sendBtn = document.getElementById('sendBtn');
const fileInput = document.getElementById('fileInput');
const sendFileBtn = document.getElementById('sendFileBtn');

// ヘルパー: 現在時刻 MM/DD HH:MM
function getTimeStamp() {
  const d = new Date();
  return `${d.getMonth()+1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2,'0')}`;
}

// --- プロフィール登録・変更 ---
async function sendProfile() {
  const name = nameInput.value.trim();
  if (!name) return;

  let iconUrl = myProfile.icon || '';
  if (iconInput.files.length > 0) {
    const formData = new FormData();
    formData.append('icon', iconInput.files[0]);
    const res = await fetch('/upload', { method: 'POST', body: formData });
    const data = await res.json();
    iconUrl = data.url;
  }

  myProfile = { name, icon: iconUrl };
  socket.emit('register', myProfile);
}

registerBtn.onclick = sendProfile;
editProfileBtn.onclick = sendProfile;

// --- オンラインユーザー表示 ---
socket.on('online-users', (users) => {
  usersDiv.innerHTML = '';
  for (const [id, user] of Object.entries(users)) {
    const div = document.createElement('div');
    div.style.display = 'flex';
    div.style.alignItems = 'center';
    div.style.cursor = 'pointer';
    div.style.padding = '4px';
    div.style.borderRadius = '4px';
    div.onmouseenter = () => div.style.background = '#40444b';
    div.onmouseleave = () => div.style.background = 'transparent';

    const status = document.createElement('span');
    status.style.width = '10px';
    status.style.height = '10px';
    status.style.borderRadius = '50%';
    status.style.marginRight = '5px';
    status.style.backgroundColor = user.status === 'online' ? 'green' : 'gray';

    const img = document.createElement('img');
    img.src = user.icon || '/default_icon.png';
    img.width = 32; img.height = 32;
    img.style.marginRight = '5px';

    const nameSpan = document.createElement('span');
    nameSpan.textContent = user.name + (id === socket.id ? ' (自分)' : '');

    div.appendChild(status);
    div.appendChild(img);
    div.appendChild(nameSpan);

    div.onclick = () => { if(id !== socket.id) startCall(id); };

    usersDiv.appendChild(div);
  }
});

// --- チャット送信 ---
async function handleMessage(msgText) {
  if (!msgText.trim()) return;
  const timestamp = getTimeStamp();

  let preview = null;
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const urls = msgText.match(urlRegex);
  if(urls){
    try{
      const res = await fetch(`/url-preview?url=${encodeURIComponent(urls[0])}`);
      preview = await res.json();
    }catch{}
  }

  const msgData = { profile: myProfile, msg: msgText, timestamp, preview };
  socket.emit('chat message', msgData);
  appendMessage(msgData.profile, msgData, timestamp);
}

sendBtn.onclick = () => {
  handleMessage(chatInput.value);
  chatInput.value = '';
};

chatInput.addEventListener('keydown', e=>{
  if(e.key==='Enter' && !e.shiftKey){
    e.preventDefault();
    sendBtn.click();
  }
});

chatInput.addEventListener('input', ()=>{
  socket.emit('typing', true);
  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(()=>socket.emit('typing', false), 1000);
});

// --- ファイル送信 ---
sendFileBtn.onclick = async () => {
  if(fileInput.files.length===0) return;
  const formData = new FormData();
  formData.append('file', fileInput.files[0]);
  const res = await fetch('/chat-upload',{method:'POST',body:formData});
  const data = await res.json();
  const msgData = { profile: myProfile, msg:'', timestamp:getTimeStamp(), file:data };
  socket.emit('chat message', msgData);
  appendMessage(msgData.profile,msgData,msgData.timestamp);
  fileInput.value = '';
};

// --- 受信・描画 ---
socket.on('chat message', appendMessage);

function appendMessage(profile,msgData,timestamp){
  const li = document.createElement('li');
  li.style.display='flex';
  li.style.alignItems='flex-start';
  li.style.marginBottom='10px';

  const img = document.createElement('img');
  img.src = profile.icon || '/default_icon.png';
  img.width=32; img.height=32; img.style.marginRight='8px'; img.style.borderRadius='50%';

  const contentDiv = document.createElement('div');
  const textDiv = document.createElement('div');
  textDiv.innerHTML = `[${timestamp}] ${profile.name}: ${msgData.msg}`;
  contentDiv.appendChild(textDiv);

  // URLプレビュー
  if(msgData.preview){
    const previewDiv = document.createElement('div');
    previewDiv.style.border='1px solid #ccc';
    previewDiv.style.padding='5px';
    previewDiv.style.marginTop='5px';
    previewDiv.style.maxWidth='300px';
    previewDiv.style.borderRadius='5px';
    previewDiv.style.display='flex';
    previewDiv.style.alignItems='center';

    if(msgData.preview.image){
      const imgThumb = document.createElement('img');
      imgThumb.src = msgData.preview.image;
      imgThumb.style.width='60px';
      imgThumb.style.height='60px';
      imgThumb.style.objectFit='cover';
      imgThumb.style.marginRight='8px';
      previewDiv.appendChild(imgThumb);
    }

    const infoDiv = document.createElement('div');
    infoDiv.style.display='flex';
    infoDiv.style.flexDirection='column';
    const title = document.createElement('strong');
    title.textContent = msgData.preview.title||msgData.preview.url;
    infoDiv.appendChild(title);
    if(msgData.preview.description){
      const desc = document.createElement('span');
      desc.textContent = msgData.preview.description;
      infoDiv.appendChild(desc);
    }
    previewDiv.appendChild(infoDiv);
    contentDiv.appendChild(previewDiv);
  }

  // ファイル表示
  if(msgData.file){
    const f = msgData.file;
    const ext = f.name.split('.').pop().toLowerCase();
    let media;
    if(['png','jpg','jpeg','gif','webp'].includes(ext)){
      media=document.createElement('img'); media.src=f.url; media.style.maxWidth='200px'; media.style.display='block'; media.style.marginTop='3px';
    } else if(['mp4','webm','ogg'].includes(ext)){
      media=document.createElement('video'); media.src=f.url; media.controls=true; media.style.maxWidth='200px'; media.style.display='block'; media.style.marginTop='3px';
    } else {
      media=document.createElement('a'); media.href=f.url; media.textContent=f.name; media.target='_blank'; media.style.display='block'; media.style.marginTop='3px';
    }
    contentDiv.appendChild(media);
  }

  li.appendChild(img);
  li.appendChild(contentDiv);
  messages.appendChild(li);
  messages.scrollTop = messages.scrollHeight;
}

// --- 入力中表示 ---
socket.on('typing',({id,isTyping})=>{
  typingUsers[id]=isTyping;
  const names = Object.entries(typingUsers).filter(([_,v])=>v).map(([id])=>id===socket.id?'あなた':id);
  typingStatus.textContent = names.length>0 ? `${names.join(', ')} が入力中…` : '';
});

// --- WebRTC音声通話（シグナリングのみ、UIはユーザークリックで実装可能） ---
async function startCall(targetId){
  const pc = new RTCPeerConnection();
  const stream = await navigator.mediaDevices.getUserMedia({audio:true});
  stream.getTracks().forEach(track => pc.addTrack(track,stream));
  pc.onicecandidate = e=>{if(e.candidate) socket.emit('webrtc-candidate',{target:targetId,candidate:e.candidate});};
  pc.ontrack=e=>{const audio=document.createElement('audio'); audio.srcObject=e.streams[0]; audio.autoplay=true; document.body.appendChild(audio);};

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  socket.emit('webrtc-offer',{target:targetId,sdp:offer});

  socket.on('webrtc-answer',async({from,sdp})=>{if(from===targetId) await pc.setRemoteDescription(new RTCSessionDescription(sdp));});
  socket.on('webrtc-candidate',({from,candidate})=>{if(from===targetId) pc.addIceCandidate(new RTCIceCandidate(candidate));});
}

