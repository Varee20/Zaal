// ==========================================================
// main.js - PREVIEW ONLY. This is not the phone app.
// "npm start" opens Zaal Mini in a phone-sized window so you can test the screens on the PC.
// The real Android app is built from the same index.html / css / js with Capacitor (a later step).
// ==========================================================

const { app, BrowserWindow } = require('electron');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 412,        // roughly a phone's width
    height: 800,
    useContentSize: true,
    minWidth: 320,
    minHeight: 520,
    backgroundColor: '#0b0b0c',
    icon: path.join(__dirname, 'Zaal.ico'),
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true }
  });
  win.loadFile('index.html');
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
