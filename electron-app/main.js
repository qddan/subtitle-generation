const { app, BrowserWindow, shell } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

let mainWindow;
let backendProcess;
let frontendProcess;

const isDev = !app.isPackaged;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    titleBarStyle: 'hiddenInset',
    show: false,
  });

  // Load the frontend
  const frontendUrl = isDev ? 'http://localhost:3000' : 'http://localhost:3000';
  
  // Wait for frontend to be ready
  const checkFrontend = () => {
    mainWindow.loadURL(frontendUrl).catch(() => {
      setTimeout(checkFrontend, 1000);
    });
  };

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Open external links in default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  checkFrontend();
}

function startBackend() {
  if (isDev) {
    const backendPath = path.join(__dirname, '..', 'backend');
    const venvPath = path.join(__dirname, '..', 'venv314', 'bin', 'python');
    
    backendProcess = spawn(venvPath, ['-m', 'uvicorn', 'main:app', '--port', '8000'], {
      cwd: backendPath,
      stdio: 'inherit',
    });

    backendProcess.on('error', (err) => {
      console.error('Failed to start backend:', err);
    });
  } else {
    // Production: backend is bundled
    const backendPath = path.join(process.resourcesPath, 'backend');
    backendProcess = spawn('python3', ['-m', 'uvicorn', 'main:app', '--port', '8000'], {
      cwd: backendPath,
      stdio: 'inherit',
    });
  }
}

function startFrontend() {
  if (isDev) {
    const frontendPath = path.join(__dirname, '..', 'frontend');
    
    frontendProcess = spawn('npm', ['run', 'dev'], {
      cwd: frontendPath,
      stdio: 'inherit',
      shell: true,
    });

    frontendProcess.on('error', (err) => {
      console.error('Failed to start frontend:', err);
    });
  }
  // In production, frontend is pre-built and served by Next.js
}

app.whenReady().then(() => {
  startBackend();
  
  if (isDev) {
    startFrontend();
    // Wait for servers to start
    setTimeout(createWindow, 5000);
  } else {
    setTimeout(createWindow, 2000);
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  // Clean up processes
  if (backendProcess) {
    backendProcess.kill();
  }
  if (frontendProcess) {
    frontendProcess.kill();
  }
});
