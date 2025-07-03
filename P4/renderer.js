// renderer.js
const { ipcRenderer } = require('electron');

// 1) Mostrar versiones y solicitar URL al arrancar
window.addEventListener('DOMContentLoaded', () => {
 document.getElementById('nodeText').textContent = process.versions.node;
 document.getElementById('chromeText').textContent = process.versions.chrome;
 document.getElementById('electronText').textContent = process.versions.electron;

 ipcRenderer.send('requestConnectionInfo');
});

// 2) Funciones auxiliares
function getDate() {
 const d = new Date();
 const hh = d.getHours().toString().padStart(2, '0');
 const mm = d.getMinutes().toString().padStart(2, '0');
 return `${hh}:${mm}`;
}

function appendChat(author, text) {
 const type = author === 'server' ? 2 : 1;
 const div = document.createElement('div');
 div.className = `messageClassDiv${type}`;
 div.innerHTML = `
 <p class="chatTimeText">
 <span class="userName">${author}</span>
 <span class="messDate">${getDate()}</span>
 </p>
 <p class="chatText">${text}</p>
 `;
 const box = document.getElementById('smallChatDivDiv');
 box.appendChild(div);
 box.scrollTop = box.scrollHeight;
}

function sendMessage(message) {
 appendChat('server', message);
 ipcRenderer.invoke('serverMess', message);
}

function sendComplexMessage() {
 const input = document.getElementById('inputTextServer');
 const txt = input.value.trim();
 if (!txt) return;
 sendMessage(txt);
 input.value = '';
}

// 3) Listeners de teclado y botones
document.addEventListener('keydown', e => {
 if (e.key === 'Enter') sendComplexMessage();
});
document.getElementById('sendButton').addEventListener('click', sendComplexMessage);
document.getElementById('testButton').addEventListener('click', () => {
 sendMessage('Este es un mensaje de prueba. :)');
});

// 4) Canales IPC entrantes
ipcRenderer.on('usersCon', (e, clients) => {
 const num = document.getElementById('usersConNum');
 const list = document.getElementById('usersConList');
 num.textContent = clients.length;
 list.innerHTML = '';
 clients.forEach(u => {
 const d = document.createElement('div');
 d.className = 'conectedDiv';
 d.dataset.username = u.name;
 list.appendChild(d);
 });
});

ipcRenderer.on('genChat', (e, [channel, author, msg]) => {
 appendChat(author, msg);
});

ipcRenderer.on('conectionInformation', (e, raw) => {
 const [host, port] = JSON.parse(raw);
 document.getElementById('replaceURL').textContent = `http://${host}:${port}`;
});