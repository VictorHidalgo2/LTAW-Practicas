const { Server: SocketServer } = require('socket.io');
const http    = require('http');
const express = require('express');
const fs      = require('fs');
const colors  = require('colors');

const PUERTO    = 8080;
const CHAT_HTML = fs.readFileSync('userChat.html', 'utf-8');
let clients     = [];

const app    = express();
// Sirve TODOS los ficheros estáticos desde la carpeta raíz
app.use(express.static(__dirname));

const server = http.Server(app);
const io     = new SocketServer(server);

// Ruta de login
app.post('/login', (req, res) => {
  let userName = '', data = '';
  req.on('data', chunk => { data += chunk; });
  req.on('end', () => {
    const params      = new URLSearchParams(data);
    userName          = params.get('userName') || '';
    const takenNames  = clients.map(c => c.name);

    if (!userName) {
      return res.status(404).send('Necesitas un nombre de usuario, este campo no puede estar vacío');
    }
    if (userName.toLowerCase() === 'server') {
      return res.status(404).send('Nombre de usuario no disponible');
    }
    if (takenNames.includes(userName)) {
      return res.status(404).send('Nombre de usuario empleado por otra persona');
    }
    res.send(CHAT_HTML);
  });
});

// Ruta para el botón de prueba
app.get('/broadcast-test', (_, res) => {
  io.emit('message', JSON.stringify(['general','server','Mensaje de prueba desde servidor']));
  res.send('Mensaje de prueba enviado a todos');
});

// Envía texto al <div id="log"> de la ventana Electron
function logToUI(text) {
  try {
    const { BrowserWindow } = require('electron');
    const win = BrowserWindow.getAllWindows()[0];
    if (!win) return;
    const safe = text.replace(/`/g,'\\`').replace(/<\/script>/g,'<\\/script>');
    win.webContents.executeJavaScript(`
      const log = document.getElementById('log');
      log.innerHTML += '<div>${safe}</div>';
      log.scrollTop = log.scrollHeight;
    `);
  } catch{}
}

// WebSockets
io.on('connect', socket => {
  socket.on('connect_login', user => {
    console.log('Nueva conexión: '.green + socket.id.blue + ' → ' + user.yellow);
    clients.push({ name: user, id: socket.id });
    io.emit('chatList', JSON.stringify(clients));
    socket.broadcast.emit('message', JSON.stringify(['general','server',`Se ha conectado: ${user}`]));
    socket.emit('message', JSON.stringify(['general','server',`Bienvenido, ${user}`]));
    logToUI(`[server] Se ha conectado: ${user}`);
  });

  socket.on('message', msgString => {
    const msg = JSON.parse(msgString);
    // reenviar o enviar privado
    if (msg[2].startsWith('/')) {
      spetialCommands(msg[2], socket, msg[1], msg[0]);
    } else if (msg[0] === 'general') {
      socket.broadcast.emit('message', JSON.stringify(msg));
    } else {
      const dest = msg[0];
      msg[0] = socket.id;
      io.to(dest).emit('message', JSON.stringify(msg));
    }
    logToUI(`[${msg[1]}] ${msg[2]}`);
  });

  socket.on('disconnect', () => {
    console.log('CONEXIÓN TERMINADA CON: '.red + socket.id.yellow);
    clients = clients.filter(c => {
      if (c.id === socket.id) {
        io.emit('message', JSON.stringify(['general','server',`Se ha desconectado: ${c.name}`]));
        logToUI(`[server] Se ha desconectado: ${c.name}`);
        return false;
      }
      return true;
    });
    io.emit('chatList', JSON.stringify(clients));
  });
});

// Comandos especiales
function spetialCommands(cmd, socket, name, channel) {
  switch (cmd) {
    case '/help':
      socket.emit('message', JSON.stringify([channel,'server',
        'Comandos:<br> - /list<br> - /hello<br> - /date'
      ]));
      break;
    case '/list':
      let resp = 'Usuarios conectados:';
      const others = clients.filter(c => c.id !== socket.id);
      if (others.length === 0) resp = 'No hay nadie más conectado.';
      else others.forEach(c => resp += `<br> - ${c.name}`);
      socket.emit('message', JSON.stringify([channel,'server',resp]));
      break;
    case '/hello':
      socket.emit('message', JSON.stringify([channel,'server',`Hola ${name}!`]));
      break;
    case '/date':
      socket.emit('message', JSON.stringify([channel,'server',getDate()]));
      break;
    default:
      socket.emit('message', JSON.stringify([channel,'server',
        'Comando no reconocido, escribe /help'
      ]));
  }
}

// Utilidades
function getDate() {
  const d = new Date();
  const hh = String(d.getHours()).padStart(2,'0');
  const mm = String(d.getMinutes()).padStart(2,'0');
  const ss = String(d.getSeconds()).padStart(2,'0');
  return `${hh}:${mm}:${ss}`;
}

server.listen(PUERTO, () => {
  console.log('Escuchando en puerto: '.yellow + PUERTO.toString().blue);
});