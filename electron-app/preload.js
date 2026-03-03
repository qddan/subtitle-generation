const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  platform: process.platform,
  isElectron: true,
  // Splash screen
  onSplashLog: (callback) =>
    ipcRenderer.on("splash-log", (_, msg) => callback(msg)),
  // Settings
  getSettings: () => ipcRenderer.invoke("get-settings"),
  saveSettings: (s) => ipcRenderer.invoke("save-settings", s),
  // App info
  getAppInfo: () => ipcRenderer.invoke("get-app-info"),
  // Native dialogs
  selectFolder: () => ipcRenderer.invoke("select-folder"),
  // Backend control
  restartBackend: () => ipcRenderer.invoke("restart-backend"),
});
