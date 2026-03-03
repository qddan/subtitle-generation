const {
  app,
  BrowserWindow,
  shell,
  ipcMain,
  dialog,
  Tray,
  Menu,
  nativeImage,
} = require("electron");
const path = require("path");
const fs = require("fs");
const http = require("http");
const { spawn, execSync } = require("child_process");
const handler = require("serve-handler");

// ── Constants ──────────────────────────────────────────────
const isDev = !app.isPackaged;
const BACKEND_PORT = 8000;
const FRONTEND_PORT = 3001;
const APP_DATA = path.join(app.getPath("userData"), "video2text-data");
const VENV_DIR = path.join(APP_DATA, "venv");
const SETTINGS_PATH = path.join(APP_DATA, "settings.json");

// ── Paths ──────────────────────────────────────────────────
function backendDir() {
  return isDev
    ? path.join(__dirname, "..", "backend")
    : path.join(process.resourcesPath, "backend");
}
function frontendDir() {
  return isDev
    ? path.join(__dirname, "..", "frontend", "out")
    : path.join(process.resourcesPath, "frontend");
}
function pythonBin() {
  const venvPython =
    process.platform === "win32"
      ? path.join(VENV_DIR, "Scripts", "python.exe")
      : path.join(VENV_DIR, "bin", "python3");
  if (fs.existsSync(venvPython)) return venvPython;
  // Dev fallback
  if (isDev) {
    const devVenv = path.join(__dirname, "..", "venv314", "bin", "python");
    if (fs.existsSync(devVenv)) return devVenv;
  }
  return null;
}

// ── Settings ───────────────────────────────────────────────
const DEFAULT_SETTINGS = {
  whisperModel: "small",
  language: "vi",
  maxUploadSize: 500 * 1024 * 1024,
  outputDir: path.join(APP_DATA, "transcripts"),
};

function loadSettings() {
  try {
    if (fs.existsSync(SETTINGS_PATH)) {
      return {
        ...DEFAULT_SETTINGS,
        ...JSON.parse(fs.readFileSync(SETTINGS_PATH, "utf-8")),
      };
    }
  } catch (e) {
    /* ignore */
  }
  return { ...DEFAULT_SETTINGS };
}
function saveSettings(s) {
  fs.mkdirSync(APP_DATA, { recursive: true });
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(s, null, 2));
}

let settings = loadSettings();

// ── State ──────────────────────────────────────────────────
let mainWindow = null;
let splashWindow = null;
let backendProcess = null;
let frontendServer = null;
let tray = null;
let isQuitting = false;

// ── Splash Screen ──────────────────────────────────────────
function createSplash() {
  splashWindow = new BrowserWindow({
    width: 480,
    height: 360,
    frame: false,
    resizable: false,
    transparent: false,
    alwaysOnTop: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js"),
    },
  });
  splashWindow.loadFile(path.join(__dirname, "splash.html"));
  return splashWindow;
}

function splashLog(msg) {
  if (splashWindow && !splashWindow.isDestroyed()) {
    splashWindow.webContents.send("splash-log", msg);
  }
  console.log("[Setup]", msg);
}

// ── Python Setup ───────────────────────────────────────────
function findSystemPython() {
  const candidates =
    process.platform === "win32"
      ? ["python", "python3"]
      : ["python3", "python"];
  for (const cmd of candidates) {
    try {
      const ver = execSync(`${cmd} --version 2>&1`, {
        encoding: "utf-8",
      }).trim();
      if (ver.includes("Python 3")) {
        const p = execSync(`which ${cmd} 2>/dev/null || where ${cmd} 2>nul`, {
          encoding: "utf-8",
        })
          .trim()
          .split("\n")[0];
        return p || cmd;
      }
    } catch (e) {
      /* skip */
    }
  }
  return null;
}

async function ensurePythonEnv() {
  fs.mkdirSync(APP_DATA, { recursive: true });

  const venvPy = pythonBin();
  if (venvPy) {
    splashLog("Python environment found");
    return true;
  }

  splashLog("Setting up Python environment (first time only)...");
  const sysPython = findSystemPython();
  if (!sysPython) {
    splashLog("ERROR: Python 3 not found. Please install Python 3.11+");
    dialog.showErrorBox(
      "Python Not Found",
      "Video2Text requires Python 3.11+.\n\nPlease install from https://python.org and restart the app.",
    );
    return false;
  }
  splashLog(`Found system Python: ${sysPython}`);

  // Create venv
  splashLog("Creating virtual environment...");
  try {
    execSync(`"${sysPython}" -m venv "${VENV_DIR}"`, { stdio: "pipe" });
  } catch (e) {
    splashLog(`ERROR creating venv: ${e.message}`);
    return false;
  }

  // Install dependencies
  splashLog("Installing dependencies (this may take a few minutes)...");
  const pip =
    process.platform === "win32"
      ? path.join(VENV_DIR, "Scripts", "pip")
      : path.join(VENV_DIR, "bin", "pip");
  const reqFile = path.join(backendDir(), "requirements.txt");

  return new Promise((resolve) => {
    const install = spawn(pip, ["install", "-r", reqFile], {
      stdio: ["pipe", "pipe", "pipe"],
    });
    install.stdout.on("data", (d) => {
      const line = d.toString().trim();
      if (line.includes("Successfully installed"))
        splashLog("Dependencies installed!");
      else if (line.includes("Collecting") || line.includes("Installing"))
        splashLog(line.substring(0, 80));
    });
    install.stderr.on("data", (d) => {
      const line = d.toString().trim();
      if (line && !line.includes("[notice]")) splashLog(line.substring(0, 80));
    });
    install.on("close", (code) => {
      if (code === 0) {
        splashLog("Python setup complete!");
        resolve(true);
      } else {
        splashLog(`ERROR: pip install failed with code ${code}`);
        resolve(false);
      }
    });
  });
}

// ── Backend ────────────────────────────────────────────────
function startBackend() {
  const py = pythonBin();
  if (!py) {
    console.error("No Python binary found");
    return;
  }

  const bDir = backendDir();
  const env = {
    ...process.env,
    WHISPER_MODEL: settings.whisperModel,
    LANGUAGE: settings.language,
    OUTPUT_DIR: settings.outputDir,
    MAX_UPLOAD_SIZE: String(settings.maxUploadSize),
    ALLOWED_ORIGINS: `http://localhost:${FRONTEND_PORT},http://127.0.0.1:${FRONTEND_PORT}`,
  };

  fs.mkdirSync(settings.outputDir, { recursive: true });

  backendProcess = spawn(
    py,
    [
      "-m",
      "uvicorn",
      "main:app",
      "--host",
      "127.0.0.1",
      "--port",
      String(BACKEND_PORT),
    ],
    {
      cwd: bDir,
      env,
      stdio: ["pipe", "pipe", "pipe"],
    },
  );

  backendProcess.stdout.on("data", (d) =>
    console.log("[Backend]", d.toString().trim()),
  );
  backendProcess.stderr.on("data", (d) =>
    console.log("[Backend]", d.toString().trim()),
  );
  backendProcess.on("error", (err) => console.error("[Backend] Failed:", err));
  backendProcess.on("close", (code) => {
    console.log(`[Backend] exited with code ${code}`);
    backendProcess = null;
  });
}

function stopBackend() {
  if (backendProcess) {
    backendProcess.kill("SIGTERM");
    setTimeout(() => {
      if (backendProcess) backendProcess.kill("SIGKILL");
    }, 3000);
  }
}

// ── Frontend Server ────────────────────────────────────────
function startFrontendServer() {
  const fDir = frontendDir();
  return new Promise((resolve) => {
    frontendServer = http.createServer((req, res) => {
      return handler(req, res, {
        public: fDir,
        rewrites: [{ source: "/**", destination: "/index.html" }],
        headers: [
          {
            source: "**",
            headers: [{ key: "Cache-Control", value: "no-cache" }],
          },
        ],
      });
    });
    frontendServer.listen(FRONTEND_PORT, "127.0.0.1", () => {
      console.log(
        `[Frontend] Serving static at http://127.0.0.1:${FRONTEND_PORT}`,
      );
      resolve();
    });
  });
}

// ── Wait for backend ───────────────────────────────────────
function waitForBackend(maxRetries = 30) {
  return new Promise((resolve) => {
    let attempts = 0;
    const check = () => {
      const req = http.get(
        `http://127.0.0.1:${BACKEND_PORT}/api/stats`,
        (res) => {
          if (res.statusCode === 200) return resolve(true);
          retry();
        },
      );
      req.on("error", retry);
      req.setTimeout(1000, retry);
    };
    const retry = () => {
      attempts++;
      if (attempts >= maxRetries) return resolve(false);
      setTimeout(check, 1000);
    };
    check();
  });
}

// ── Main Window ────────────────────────────────────────────
function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js"),
    },
    titleBarStyle: "hiddenInset",
    show: false,
    title: "Video2Text",
  });

  mainWindow.loadURL(`http://127.0.0.1:${FRONTEND_PORT}`);

  mainWindow.once("ready-to-show", () => {
    if (splashWindow && !splashWindow.isDestroyed()) splashWindow.close();
    mainWindow.show();
    mainWindow.focus();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (
      url.startsWith("http") &&
      !url.includes("127.0.0.1") &&
      !url.includes("localhost")
    ) {
      shell.openExternal(url);
      return { action: "deny" };
    }
    return { action: "allow" };
  });

  mainWindow.on("close", (e) => {
    if (!isQuitting && process.platform === "darwin") {
      e.preventDefault();
      mainWindow.hide();
    }
  });
}

// ── System Tray ────────────────────────────────────────────
function createTray() {
  const iconSize = 16;
  const icon = nativeImage.createEmpty();
  // Simple tray with text-based icon (no external file needed)
  tray = new Tray(icon);

  const contextMenu = Menu.buildFromTemplate([
    {
      label: "Show Video2Text",
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      },
    },
    { type: "separator" },
    {
      label: `Model: ${settings.whisperModel}`,
      submenu: ["tiny", "base", "small", "medium", "large"].map((m) => ({
        label: m,
        type: "radio",
        checked: settings.whisperModel === m,
        click: () => {
          settings.whisperModel = m;
          saveSettings(settings);
          createTray(); // Rebuild menu
          dialog.showMessageBox({
            message: `Whisper model changed to "${m}".\nRestart the app to apply.`,
            buttons: ["OK"],
          });
        },
      })),
    },
    {
      label: `Language: ${settings.language}`,
      submenu: [
        { code: "vi", label: "Vietnamese" },
        { code: "en", label: "English" },
        { code: "ja", label: "Japanese" },
        { code: "ko", label: "Korean" },
        { code: "zh", label: "Chinese" },
      ].map((l) => ({
        label: l.label,
        type: "radio",
        checked: settings.language === l.code,
        click: () => {
          settings.language = l.code;
          saveSettings(settings);
          createTray();
        },
      })),
    },
    { type: "separator" },
    {
      label: "Open Transcripts Folder",
      click: () => shell.openPath(settings.outputDir),
    },
    {
      label: "Open Backend Logs",
      click: () => {
        if (mainWindow) mainWindow.webContents.openDevTools();
      },
    },
    { type: "separator" },
    {
      label: "Quit Video2Text",
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setToolTip("Video2Text - AI Transcription");
  tray.setContextMenu(contextMenu);
  tray.on("double-click", () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

// ── IPC Handlers ───────────────────────────────────────────
function setupIPC() {
  ipcMain.handle("get-settings", () => settings);

  ipcMain.handle("save-settings", (_, newSettings) => {
    settings = { ...settings, ...newSettings };
    saveSettings(settings);
    return settings;
  });

  ipcMain.handle("get-app-info", () => ({
    version: app.getVersion(),
    platform: process.platform,
    arch: process.arch,
    dataDir: APP_DATA,
    transcriptsDir: settings.outputDir,
    backendUrl: `http://127.0.0.1:${BACKEND_PORT}`,
    isDev,
  }));

  ipcMain.handle("select-folder", async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ["openDirectory"],
    });
    return result.canceled ? null : result.filePaths[0];
  });

  ipcMain.handle("restart-backend", async () => {
    stopBackend();
    await new Promise((r) => setTimeout(r, 2000));
    startBackend();
    return waitForBackend();
  });
}

// ── App Lifecycle ──────────────────────────────────────────
app.whenReady().then(async () => {
  createSplash();
  setupIPC();

  // Step 1: Ensure Python
  splashLog("Checking Python environment...");
  const pyReady = await ensurePythonEnv();
  if (!pyReady) {
    app.quit();
    return;
  }

  // Step 2: Start frontend server
  splashLog("Starting frontend...");
  await startFrontendServer();

  // Step 3: Start backend
  splashLog("Starting backend server...");
  startBackend();

  // Step 4: Wait for backend
  splashLog("Waiting for backend to be ready...");
  const backendReady = await waitForBackend();
  if (!backendReady) {
    splashLog("WARNING: Backend may not be fully ready");
  } else {
    splashLog("Backend is ready!");
  }

  // Step 5: Show main window
  createMainWindow();
  createTray();
});

app.on("activate", () => {
  if (mainWindow) {
    mainWindow.show();
    mainWindow.focus();
  } else if (BrowserWindow.getAllWindows().length === 0) {
    createMainWindow();
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    isQuitting = true;
    app.quit();
  }
});

app.on("before-quit", () => {
  isQuitting = true;
  stopBackend();
  if (frontendServer) frontendServer.close();
  if (tray) tray.destroy();
});
