const { app, BrowserWindow } = require('electron');
const os = require('os');
const path = require('path');
app.disableHardwareAcceleration(); 

// Arranca el servidor Express + Socket.IO
require('./server');

function getLocalIP() {
  const ifaces = os.networkInterfaces();
  for (const name in ifaces) {
    for (const iface of ifaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

function createWindow() {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'renderer.js'),
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  win.loadFile('index.html');
  win.webContents.on('did-finish-load', () => {
    win.webContents.send('env-info', {
      node: process.versions.node,
      chrome: process.versions.chrome,
      electron: process.versions.electron,
      url: `http://${getLocalIP()}:8080`
    });
  });
}

app.whenReady().then(createWindow);