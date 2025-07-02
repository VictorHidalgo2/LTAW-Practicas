const { ipcRenderer } = require('electron');

window.addEventListener('DOMContentLoaded', () => {
  ipcRenderer.on('env-info', (_, info) => {
    document.getElementById('nodeVer').innerText     = info.node;
    document.getElementById('chromeVer').innerText   = info.chrome;
    document.getElementById('electronVer').innerText = info.electron;
    document.getElementById('url').innerText         = info.url;
  });

  document.getElementById('testButton').addEventListener('click', () => {
    fetch(`http://localhost:8080/broadcast-test`);
  });
});