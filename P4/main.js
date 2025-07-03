// main.js
const { app, BrowserWindow, ipcMain } = require('electron');
const socketServer = require('socket.io').Server;
const http     = require('http');
const express  = require('express');
const fs       = require('fs');
const ip       = require('ip');
require('colors');

app.on('ready', () => {
  const PUERTO    = 8080;
  const CHAT_HTML = fs.readFileSync('userChat.html', 'utf-8');
  let clients     = [];

  // 1) Express + Socket.io para usuarios web
  const webApp = express();
  webApp.use('/', express.static(__dirname));

  webApp.post('/login', (req, res) => {
    let data = '';
    req.on('data', chunk => data += chunk);
    req.on('end', () => {
      const params   = new URLSearchParams(data);
      const userName = params.get('userName') || '';
      const taken    = clients.map(c => c.name);

      if (taken.includes(userName)) {
        res.status(404).send('Nombre de usuario empleado por otra persona');
      } else if (userName.toLowerCase() === 'server') {
        res.status(404).send('Nombre de usuario no disponible');
      } else if (!userName.trim()) {
        res.status(404).send('Necesitas un nombre de usuario, este campo no puede estar vacio');
      } else {
        res.send(CHAT_HTML);
      }
    });
  });

  const server = http.Server(webApp);
  const io     = new socketServer(server);

  io.on('connect', socket => {
    // Login
    socket.on('connect_login', name => {
      console.log('Nueva conexión: '.green + socket.id.blue + ': ' + name.yellow);
      clients.push({ name, id: socket.id });

      socket.broadcast.emit('message', JSON.stringify(['general','server', `Se ha conectado: ${name}`]));
      io.emit('chatList', JSON.stringify(clients));
      socket.emit('message', JSON.stringify(['general','server', `Hola ${name}, bienvenido.`]));

      // Actualizar panel de Electron
      win.webContents.send('usersCon', clients);
      win.webContents.send('genChat', ['general','server', `Se ha conectado: ${name}`]);
    });

    // Disconnect
    socket.on('disconnect', () => {
      console.log('CONEXIÓN TERMINADA CON: '.red + socket.id.yellow);
      let discName = '';
      clients = clients.filter(c => {
        if (c.id === socket.id) discName = c.name;
        return c.id !== socket.id;
      });

      if (discName) {
        io.emit('message', JSON.stringify(['general','server', `Se ha desconectado ${discName}`]));
        win.webContents.send('genChat', ['general','server', `Se ha desconectado: ${discName}`]);
      }
      io.emit('chatList', JSON.stringify(clients));
      win.webContents.send('usersCon', clients);
    });

    // Chat
    socket.on('message', msg => {
      showMesageData(msg, socket.id);

      if (msg[2].startsWith('/')) {
        spetialCommands(msg[2], socket, msg[1], msg[0]);
      } else {
        if (msg[0] === 'general') {
          socket.broadcast.emit('message', JSON.stringify(msg));
          win.webContents.send('genChat', msg);
        } else {
          const to = msg[0];
          msg[0] = socket.id;
          io.to(to).emit('message', JSON.stringify(msg));
        }
      }
    });
  });

  server.listen(PUERTO, () => {
    console.log('Escuchando en puerto: '.yellow + PUERTO.toString().blue);
  });

  // Comandos especiales
  function spetialCommands(cmd, socket, name, channel) {
    switch (cmd) {
      case '/help':
        socket.emit('message', JSON.stringify([channel,'server',
          'Comandos disponibles:<br>- /list<br>- /hello<br>- /date']));
        break;
      case '/list':
        let resp = 'Usuarios conectados:<br>';
        clients.forEach(c => {
          if (c.id !== socket.id) resp += `- ${c.name}<br>`;
        });
        if (clients.length <= 1) resp = 'No hay nadie más conectado.';
        socket.emit('message', JSON.stringify([channel,'server', resp]));
        break;
      case '/hello':
        socket.emit('message', JSON.stringify([channel,'server', `Hola ${name}!`]));
        break;
      case '/date':
        socket.emit('message', JSON.stringify([channel,'server', getDate()]));
        break;
      default:
        socket.emit('message', JSON.stringify([channel,'server',
          'Comando no reconocido. Usa /help.']));
    }
  }

  function getDate(){
    const d = new Date();
    const dd = d.getDate().toString().padStart(2,'0');
    const mm = (d.getMonth()+1).toString().padStart(2,'0');
    const yy = d.getFullYear();
    const hh = d.getHours().toString().padStart(2,'0');
    const mi = d.getMinutes().toString().padStart(2,'0');
    const ss = d.getSeconds().toString().padStart(2,'0');
    return `Es el dia: ${dd}/${mm}/${yy}, a las ${hh}:${mi}:${ss}`;
  }

  function showMesageData(msg, id){
    console.log('------------------------------------------------'.white);
    console.log('Mensaje recibido'.magenta);
    console.log('Origen: '.blue + id.yellow);
    console.log('Canal: '.blue + msg[0].yellow);
    console.log('Contenido: '.blue + (msg[0]==='general' ? msg[2].yellow : 'PRIVATE'));
    console.log('------------------------------------------------'.white);
  }

  // 2) Crear ventana de Electron
  let win = new BrowserWindow({
    width: 1200,
    height: 750,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });
  win.setMenuBarVisibility(false);

  // 3) Cuando esté lista para mostrar, enviamos estado
  win.once('ready-to-show', () => {
    win.webContents.send('usersCon', clients);
    win.webContents.send('conectionInformation',
      JSON.stringify([ ip.address(), PUERTO ]));
  });

  // 4) Manejar mensaje de “server” enviado desde el renderer
  ipcMain.handle('serverMess', (event, msg) => {
    io.emit('message', JSON.stringify(['general','server', msg]));
    win.webContents.send('genChat', ['general','server', msg]);
    return true;
  });

  // 5) Cargar interfaz
  win.loadFile('renderer.html');
});