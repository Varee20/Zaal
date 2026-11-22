const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('pc', {
  getVersion: () => ipcRenderer.invoke('app-version'),
  getStats: () => ipcRenderer.invoke('get-stats'),
  loadData: () => ipcRenderer.invoke('load-data'),
  saveData: (data) => ipcRenderer.invoke('save-data', data),
  getAutostart: () => ipcRenderer.invoke('get-autostart'),
  setAutostart: (on) => ipcRenderer.invoke('set-autostart', on),
  googleStatus: () => ipcRenderer.invoke('google-status'),
  googleSaveCreds: (id, secret) => ipcRenderer.invoke('google-save-creds', id, secret),
  googleConnect: () => ipcRenderer.invoke('google-connect'),
  googleDisconnect: () => ipcRenderer.invoke('google-disconnect'),
  googleSync: () => ipcRenderer.invoke('google-sync'),
  quickAction: (action) => ipcRenderer.invoke('quick-action', action),
  weatherGeocode: (name) => ipcRenderer.invoke('weather-geocode', name),
  weatherNow: (lat, lon) => ipcRenderer.invoke('weather-now', lat, lon),
  // Local AI assistant (Ollama)
  aiStatus: () => ipcRenderer.invoke('ai-status'),
  aiSetup: (model) => ipcRenderer.invoke('ai-setup', model),
  aiChat: (payload) => ipcRenderer.invoke('ai-chat', payload),
  onAiProgress: (callback) => ipcRenderer.on('ai-progress', (event, progress) => callback(progress))
});
