const socket = io();
let myProfile = { name:"", avatar:"" };
let localStream, peerConnection, remoteId = null;
const configuration = { iceServers:[{urls:"stun:stun.l.google.com:19302"}] };

const nameInput=document.getElementById("nameInput");
const iconInput=document.getElementById("iconInput");
const registerBtn=document.getElementById("registerBtn");
const usersDiv=document.getElementById("users");

const chatInput=document.getElementById("chatInput");
const sendBtn=document.getElementById("sendBtn");
const messages=document.getElementById("messages");
const fileInput=document.getElementById("fileInput");
const sendFileBtn=document.getElementById("sendFileBtn");

const callWithSpan=document.getElementById("callWith");
const hangupBtn=document.getElementById("hangupBtn");

// 時刻
function getTimeStamp(){ const now=new Date(); return `${now.getMonth()+1}/${now.getDate()} ${now.getHours()}:${now.getMinutes().toString().padStart(2,"0")}` }

// プロフィール登録
registerBtn.onclick=async()=>{
  const name=nameInput.value.trim(); if(!name)return;
  let avatarUrl="";
  if(iconInput.files.length>0){
    const fd=new FormData(); fd.append("file",iconInput.files[0]);
    const res=await fetch("/upload",{method:"POST",body:fd}); const data=await res.json();
    avatarUrl=data.url;
  }
  myProfile={name,avatar:avatarUrl};
  socket.emit("setProfile",myProfile);
};

// オンラインユーザー表示
socket.on("updateUsers",users=>{
  usersDiv.innerHTML="";
  for(const[id,user] of Object.entries(users)){
    if(id===socket.id) continue;
    const div=document.createElement("div"); div.style.display="flex"; div.style.alignItems="center"; div.style.marginBottom="5px";
    const status=document.createElement("span"); status.style.width="10px"; status.style.height="10px"; status.style.borderRadius="50%"; status.style.backgroundColor=user.online?"green":"gray"; status.style.marginRight="5px";
    const img=document.createElement("img"); img.src=user.avatar||"/default_icon.png"; img.width=24; img.height=24;
    const span=document.createElement("span"); span.textContent=user.name;
    div.appendChild(status); div.appendChild(img); div.appendChild(span); usersDiv.appendChild(div);
    div.style.cursor="pointer"; div.onclick=()=>startCall(id,user.name);
  }
});

// メッセージ送信
sendBtn.onclick=()=>{
  if(!chatInput.value.trim())return;
  const timestamp=getTimeStamp();
  const msgData={msg:chatInput.value,timestamp};
  socket.emit("chat message",msgData);
  appendMessage(myProfile,msgData);
  chatInput.value="";
};

// ファイル送信
sendFileBtn.onclick=async()=>{
  if(fileInput.files.length===0) return;
  const fd=new FormData(); fd.append("file",fileInput.files[0]);
  const res=await fetch("/upload",{method:"POST",body:fd});
  const data=await res.json();
  const timestamp=getTimeStamp();
  const msgData={msg:"",timestamp,file:data};
  socket.emit("chat message",msgData);
  appendMessage(myProfile,msgData);
  fileInput.value="";
};

// メッセージ受信
socket.on("chat message",msgData=>{
  const profile={name:msgData.name,avatar:msgData.avatar};
  appendMessage(profile,msgData);
});

// 描画
function appendMessage(profile,msgData){
  const li=document.createElement("li"); li.className="message";
  const icon=document.createElement("img"); icon.src=profile.avatar||"/default_icon.png"; icon.className="message-icon";
  const content=document.createElement("div"); content.className="message-content";
  const header=document.createElement("div"); header.className="message-header";
  header.innerHTML=`<span class="message-username">${profile.name}</span> ${msgData.timestamp}`;
  content.appendChild(header);

  if(msgData.msg){
    const textNode=document.createElement("div"); textNode.className="message-text";
    const urlRegex=/(https?:\/\/[^\s]+)/g;
    textNode.innerHTML=msgData.msg.replace(urlRegex,url=>`<a href="${url}" target="_blank">${url}</a>`);
    content.appendChild(textNode);
  }

  if(msgData.file){
    const file=msgData.file; const ext=file.url.split(".").pop().toLowerCase();
    const attach=document.createElement("div"); attach.className="message-attachment";
    if(["png","jpg","jpeg","gif","webp"].includes(ext)){ const img=document.createElement("img"); img.src=file.url; attach.appendChild(img); }
    else if(["mp4","webm","ogg"].includes(ext)){ const video=document.createElement("video"); video.src=file.url; video.controls=true; attach.appendChild(video); }
    else if(["mp3","wav","ogg"].includes(ext)){ const audio=document.createElement("audio"); audio.src=file.url; audio.controls=true; attach.appendChild(audio); }
    else{ const link=document.createElement("a"); link.href=file.url; link.textContent=`📎 ${file.url.split("/").pop()}`; link.target="_blank"; attach.appendChild(link); }
    content.appendChild(attach);
  }

  li.appendChild(icon); li.appendChild(content); messages.appendChild(li);
  messages.scrollTop=messages.scrollHeight;
}

// WebRTC通話
async function initLocalStream(){ localStream=await navigator.mediaDevices.getUserMedia({audio:true}); }

async function startCall(targetId,targetName){
  remoteId=targetId; callWithSpan.textContent=`通話相手: ${targetName}`; hangupBtn.disabled=false;
  await initLocalStream();
  peerConnection=new RTCPeerConnection(configuration);
  localStream.getTracks().forEach(t=>peerConnection.addTrack(t,localStream));
  peerConnection.ontrack=e=>{
    let audio=document.getElementById("remoteAudio");
    if(!audio){ audio=document.createElement("audio"); audio.id="remoteAudio"; audio.autoplay=true; document.body.appendChild(audio);}
    audio.srcObject=e.streams[0];
  };
  peerConnection.onicecandidate=e=>{ if(e.candidate) socket.emit("ice-candidate",{to:remoteId,candidate:e.candidate}); };
  const offer=await peerConnection.createOffer(); await peerConnection.setLocalDescription(offer);
  socket.emit("call",{to:remoteId,offer});
}

hangupBtn.onclick=()=>{
  if(peerConnection) peerConnection.close(); peerConnection=null;
  remoteId=null; hangupBtn.disabled=true; callWithSpan.textContent="通話相手: なし";
  const audio=document.getElementById("remoteAudio"); if(audio) audio.remove();
}

// シグナリング
socket.on("call",async({from,offer})=>{
  remoteId=from; callWithSpan.textContent="通話相手: ユーザー"; await initLocalStream();
  peerConnection=new RTCPeerConnection(configuration);
  localStream.getTracks().forEach(t=>peerConnection.addTrack(t,localStream));
  peerConnection.ontrack=e=>{
    let audio=document.getElementById("remoteAudio");
    if(!audio){ audio=document.createElement("audio"); audio.id="remoteAudio"; audio.autoplay=true; document.body.appendChild(audio);}
    audio.srcObject=e.streams[0];
  };
  peerConnection.onicecandidate=e=>{ if(e.candidate) socket.emit("ice-candidate",{to:from,candidate:e.candidate}); };
  await peerConnection.setRemoteDescription(offer);
  const answer=await peerConnection.createAnswer(); await peerConnection.setLocalDescription(answer);
  socket.emit("answer",{to:from,answer});
});

socket.on("answer",async({answer})=>{ if(peerConnection) await peerConnection.setRemoteDescription(answer); });
socket.on("ice-candidate",async({candidate})=>{ if(peerConnection) await peerConnection.addIceCandidate(candidate); });
