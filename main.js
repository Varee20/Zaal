const { app, BrowserWindow, ipcMain, shell, safeStorage, dialog } = require('electron');
const os = require('os');
const path = require('path');
const fs = require('fs');
const http = require('http');
const crypto = require('crypto');
const { execFile } = require('child_process');
const si = require('systeminformation');

// ===== ZAAL LITE =====
// Same app, but built to be gentle on old / weak PCs:
//  - no PowerShell polling (that was the biggest CPU eater)
//  - CPU and RAM are read straight from Node, for free
//  - slow things (battery, drives, Wi-Fi, temperature) are read rarely and cached
//  - nothing is read at all while the window is minimized or you are not on the Dashboard
//  - no GPU polling and no AI center (the local AI model is far too heavy for weak PCs)

// AppImages can't use Chromium's sandbox on some distros (Ubuntu 24.04 and newer), so turn it off only for the AppImage
if (process.platform === 'linux' && process.env.APPIMAGE) app.commandLine.appendSwitch('no-sandbox');

// Tasks and calendar events live in data.json, Google login info lives in config.json
const dataFile = path.join(app.getPath('userData'), 'data.json');
const cfgFile = path.join(app.getPath('userData'), 'config.json');

// ---------- One-time move from the old name so nothing is lost ----------
// Saved data used to live in %APPDATA%\pc-manager. Copy it into the new Zaal folder the first time.
(function migrateFromOldName() {
  try {
    const oldDir = path.join(app.getPath('appData'), 'pc-manager');
    const newDir = app.getPath('userData');
    if (oldDir === newDir || !fs.existsSync(oldDir)) return;
    fs.mkdirSync(newDir, { recursive: true });
    ['data.json', 'config.json'].forEach(f => {
      const from = path.join(oldDir, f), to = path.join(newDir, f);
      if (fs.existsSync(from) && !fs.existsSync(to)) fs.copyFileSync(from, to);
    });
  } catch (e) { /* if this fails the app just starts fresh */ }
})();

function createWindow() {
  const win = new BrowserWindow({
    width: 1000,
    height: 650,
    minWidth: 760,
    minHeight: 520,
    backgroundColor: '#0b0b0c',
    icon: path.join(__dirname, process.platform === 'linux' ? 'build/icon.png' : 'Zaal.ico'),
    autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), spellcheck: false }
  });
  win.loadFile('index.html');
}

// ---------- System stats (lite) ----------
// Each slow reading has a small cache: it is only refreshed when the dashboard asks AND the last reading is old enough.
const slow = {
  battery: { at: 0, busy: false, val: null },
  drives: { at: 0, busy: false, val: [] },
  wifi: { at: 0, busy: false, val: null },
  temp: { at: 0, busy: false, val: null },
  net: { at: 0, busy: false, val: { down: 0, up: 0 }, prev: null }
};

function refresh(c, maxAgeMs, job) {
  if (c.busy || Date.now() - c.at < maxAgeMs) return;
  c.busy = true;
  c.at = Date.now();
  Promise.resolve().then(job).catch(() => {}).finally(() => { c.busy = false; c.at = Date.now(); });
}

// CPU load: compare the CPU's idle/busy counters between two calls (free, no extra process)
function cpuTimes() {
  let idle = 0, total = 0;
  for (const c of os.cpus()) {
    const t = c.times;
    idle += t.idle;
    total += t.user + t.nice + t.sys + t.idle + t.irq;
  }
  return { idle, total };
}
let cpuPrev = cpuTimes();
function cpuLoad() {
  const now = cpuTimes();
  const dIdle = now.idle - cpuPrev.idle, dTotal = now.total - cpuPrev.total;
  cpuPrev = now;
  return dTotal > 0 ? Math.min(Math.max((1 - dIdle / dTotal) * 100, 0), 100) : 0;
}
const cpuName = (os.cpus()[0] && os.cpus()[0].model || 'CPU').replace(/\s+/g, ' ').trim();

// Network speed. Windows: "netstat -e" is a tiny built-in program (much lighter than PowerShell).
// Its counters are 32-bit and wrap around at 4 GB, so the wrap is handled below.
const WRAP = 4294967296;
function netDelta(now, prev) { return now >= prev ? now - prev : now + WRAP - prev; }

function readNetBytes() {
  if (process.platform === 'linux') {
    let rx = 0, tx = 0;
    for (const line of fs.readFileSync('/proc/net/dev', 'utf8').split('\n').slice(2)) {
      const [name, rest] = line.split(':');
      if (!rest) continue;
      const n = name.trim();
      if (n === 'lo' || /^(docker|veth|br-|virbr|tun|tap|vmnet|zt)/.test(n)) continue;
      const f = rest.trim().split(/\s+/);
      rx += Number(f[0]);
      tx += Number(f[8]);
    }
    return Promise.resolve({ rx, tx, wraps: false });
  }
  return new Promise((resolve, reject) => {
    execFile('netstat', ['-e'], { timeout: 4000, windowsHide: true }, (err, stdout) => {
      if (err) return reject(err);
      // the first line that ends in two numbers is the "Bytes" line (works in any language)
      for (const line of String(stdout).split(/\r?\n/)) {
        const m = line.trim().match(/(\d+)\s+(\d+)$/);
        if (m) return resolve({ rx: Number(m[1]), tx: Number(m[2]), wraps: true });
      }
      reject(new Error('no bytes line'));
    });
  });
}

function updateNet() {
  return readNetBytes().then(({ rx, tx, wraps }) => {
    const now = Date.now(), p = slow.net.prev;
    if (p && now > p.t) {
      const dt = (now - p.t) / 1000;
      const dRx = wraps ? netDelta(rx, p.rx) : Math.max(0, rx - p.rx);
      const dTx = wraps ? netDelta(tx, p.tx) : Math.max(0, tx - p.tx);
      // ignore impossible jumps (an adapter that was reset)
      if (dRx / dt < 1.25e9 && dTx / dt < 1.25e9) slow.net.val = { down: dRx / dt, up: dTx / dt };
    }
    slow.net.prev = { t: now, rx, tx };
  });
}

// Temperature: the system/board thermal zone. Often not available on laptops, so it is checked only every 30 seconds.
function updateTemp() {
  if (process.platform === 'linux') {
    return si.cpuTemperature().then(t => {
      let v = t && t.main > 0 ? t.main : null;
      if (v === null) {
        try {
          const temps = fs.readdirSync('/sys/class/thermal').filter(d => d.startsWith('thermal_zone'))
            .map(d => parseInt(fs.readFileSync('/sys/class/thermal/' + d + '/temp', 'utf8'), 10) / 1000)
            .filter(x => x > 0 && x < 120);
          if (temps.length) v = Math.max(...temps);
        } catch (e) { /* none available */ }
      }
      slow.temp.val = v;
    });
  }
  if (process.platform !== 'win32') return Promise.resolve();
  const script = "$t = @(Get-CimInstance -Namespace root/wmi -ClassName MSAcpi_ThermalZoneTemperature -ErrorAction SilentlyContinue | ForEach-Object { $_.CurrentTemperature / 10 - 273.15 }); " +
    "$t = @($t | Where-Object { $_ -gt 0 -and $_ -lt 120 }); if($t.Count){ [math]::Round(($t | Measure-Object -Maximum).Maximum,1) }";
  return new Promise(resolve => {
    execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { timeout: 10000, windowsHide: true }, (err, stdout) => {
      const v = parseFloat(String(stdout).trim());
      slow.temp.val = err || isNaN(v) ? null : v;
      resolve();
    });
  });
}

ipcMain.handle('get-stats', () => {
  // refresh the slow readings only when they are old enough
  refresh(slow.net, 2500, updateNet);
  refresh(slow.battery, 30 * 1000, () => si.battery().then(b => { slow.battery.val = b; }));
  refresh(slow.drives, 60 * 1000, () => si.fsSize().then(f => { slow.drives.val = f.filter(x => x.size > 0).map(x => ({ name: x.mount || x.fs, size: x.size, used: x.used })); }));
  refresh(slow.wifi, 20 * 1000, () => si.wifiConnections().then(list => {
    const w = list && list[0];
    slow.wifi.val = w ? { ssid: w.ssid, speed: w.txRate || w.rxRate || null, quality: w.quality } : null;
  }));
  refresh(slow.temp, 30 * 1000, updateTemp);

  const total = os.totalmem();
  const bat = slow.battery.val || {};
  return {
    cpuName,
    cpuLoad: cpuLoad(),
    memUsed: total - os.freemem(),
    memTotal: total,
    batteryHas: !!bat.hasBattery,
    batteryPct: bat.percent,
    charging: bat.isCharging,
    batteryDesigned: bat.designedCapacity || 0,
    batteryMax: bat.maxCapacity || 0,
    batteryCycles: bat.cycleCount || 0,
    batteryRemaining: bat.timeRemaining || 0,
    uptime: os.uptime(),
    temp: slow.temp.val,
    drives: slow.drives.val,
    net: slow.net.val,
    wifi: slow.wifi.val
  };
});

// ---------- Tasks / events storage ----------
ipcMain.handle('load-data', () => {
  try {
    return JSON.parse(fs.readFileSync(dataFile, 'utf8'));
  } catch (e) {
    return { tasks: [], events: [], gcal: [] };
  }
});

ipcMain.handle('save-data', (event, data) => {
  fs.writeFileSync(dataFile, JSON.stringify(data, null, 2));
  return true;
});

// ---------- Launch with Windows ----------
// When running with "npm start" we have to tell Windows which folder to open too
function loginOpts() {
  return app.isPackaged ? {} : { path: process.execPath, args: [app.getAppPath()] };
}
// Electron can't do this on Linux, so Linux uses a .desktop file in ~/.config/autostart instead
const autostartFile = path.join(os.homedir(), '.config', 'autostart', 'zaal.desktop');
function linuxExec() {
  if (process.env.APPIMAGE) return '"' + process.env.APPIMAGE + '"';
  return app.isPackaged ? '"' + process.execPath + '"' : '"' + process.execPath + '" "' + app.getAppPath() + '"';
}
ipcMain.handle('get-autostart', () => (process.platform === 'linux' ? fs.existsSync(autostartFile) : app.getLoginItemSettings(loginOpts()).openAtLogin));
ipcMain.handle('set-autostart', (event, on) => {
  if (process.platform === 'linux') {
    if (on) {
      fs.mkdirSync(path.dirname(autostartFile), { recursive: true });
      fs.writeFileSync(autostartFile, '[Desktop Entry]\nType=Application\nName=Zaal\nExec=' + linuxExec() + '\nTerminal=false\nX-GNOME-Autostart-enabled=true\n');
    } else {
      try { fs.unlinkSync(autostartFile); } catch (e) { /* already gone */ }
    }
    return true;
  }
  app.setLoginItemSettings({ ...loginOpts(), openAtLogin: !!on });
  return true;
});

// ---------- Google Calendar (read-only) ----------
const SCOPE = 'https://www.googleapis.com/auth/calendar.readonly';

function readCfg() {
  try { return JSON.parse(fs.readFileSync(cfgFile, 'utf8')); } catch (e) { return {}; }
}
function writeCfg(c) { fs.writeFileSync(cfgFile, JSON.stringify(c, null, 2)); }

// Secrets are encrypted with Windows' own protection when it's available
function enc(s) {
  return safeStorage.isEncryptionAvailable()
    ? 'enc:' + safeStorage.encryptString(s).toString('base64')
    : 'raw:' + s;
}
function dec(s) {
  if (!s) return null;
  if (s.startsWith('enc:')) return safeStorage.decryptString(Buffer.from(s.slice(4), 'base64'));
  return s.slice(4);
}

async function postForm(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body)
  });
  return res.json();
}

function niceError(e) {
  return e.message === 'fetch failed'
    ? 'Could not reach Google (network problem, or it is blocked on your connection)'
    : e.message;
}

ipcMain.handle('google-status', () => {
  const c = readCfg();
  return { connected: !!c.refreshToken, clientId: c.clientId || '' };
});

ipcMain.handle('google-save-creds', (event, id, secret) => {
  const c = readCfg();
  c.clientId = id;
  c.clientSecret = enc(secret);
  writeCfg(c);
  return true;
});

ipcMain.handle('google-disconnect', () => {
  const c = readCfg();
  delete c.refreshToken;
  writeCfg(c);
  return true;
});

// Opens Google's login page in your normal browser, then catches the answer on a tiny local server
ipcMain.handle('google-connect', async () => {
  try {
    const c = readCfg();
    const clientSecret = dec(c.clientSecret);
    if (!c.clientId || !clientSecret) throw new Error('Add your Client ID and Secret first');

    const verifier = crypto.randomBytes(32).toString('base64url');
    const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
    const state = crypto.randomBytes(16).toString('hex');

    const { code, redirect } = await new Promise((resolve, reject) => {
      const server = http.createServer((req, res) => {
        const u = new URL(req.url, 'http://127.0.0.1');
        if (u.pathname !== '/cb') { res.writeHead(404); return res.end(); }
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end('<body style="font-family:sans-serif;background:#0a0d1f;color:#e6ebff;text-align:center;padding-top:80px"><h2>Connected. You can close this tab and go back to Zaal.</h2></body>');
        const redirectUri = `http://127.0.0.1:${server.address().port}/cb`;
        server.close();
        clearTimeout(timer);
        if (u.searchParams.get('state') !== state) return reject(new Error('Login check failed, try again'));
        const got = u.searchParams.get('code');
        got ? resolve({ code: got, redirect: redirectUri }) : reject(new Error(u.searchParams.get('error') || 'No code received'));
      });
      const timer = setTimeout(() => { server.close(); reject(new Error('Login timed out')); }, 3 * 60 * 1000);
      server.listen(0, '127.0.0.1', () => {
        const redirectUri = `http://127.0.0.1:${server.address().port}/cb`;
        const url = 'https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({
          client_id: c.clientId,
          redirect_uri: redirectUri,
          response_type: 'code',
          scope: SCOPE,
          code_challenge: challenge,
          code_challenge_method: 'S256',
          state,
          access_type: 'offline',
          prompt: 'consent'
        });
        shell.openExternal(url);
      });
    });

    const tok = await postForm('https://oauth2.googleapis.com/token', {
      code,
      client_id: c.clientId,
      client_secret: clientSecret,
      redirect_uri: redirect,
      grant_type: 'authorization_code',
      code_verifier: verifier
    });
    if (!tok.refresh_token) throw new Error(tok.error_description || tok.error || 'Google did not give a login token');
    const fresh = readCfg();
    fresh.refreshToken = enc(tok.refresh_token);
    writeCfg(fresh);
    return { ok: true };
  } catch (e) {
    return { error: niceError(e) };
  }
});

async function accessToken() {
  const c = readCfg();
  const rt = dec(c.refreshToken);
  if (!rt) throw new Error('Not connected to Google');
  const r = await postForm('https://oauth2.googleapis.com/token', {
    client_id: c.clientId,
    client_secret: dec(c.clientSecret),
    refresh_token: rt,
    grant_type: 'refresh_token'
  });
  if (r.error) {
    if (r.error === 'invalid_grant') {
      delete c.refreshToken;
      writeCfg(c);
      throw new Error('Google login expired, please connect again');
    }
    throw new Error(r.error_description || r.error);
  }
  return r.access_token;
}

const p2 = n => String(n).padStart(2, '0');

ipcMain.handle('google-sync', async () => {
  try {
    const token = await accessToken();
    const now = new Date();
    const min = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const max = new Date(now.getFullYear(), now.getMonth() + 4, 1);
    const url = 'https://www.googleapis.com/calendar/v3/calendars/primary/events?' + new URLSearchParams({
      timeMin: min.toISOString(),
      timeMax: max.toISOString(),
      singleEvents: 'true',
      orderBy: 'startTime',
      maxResults: '500'
    });
    const res = await fetch(url, { headers: { Authorization: 'Bearer ' + token } });
    const j = await res.json();
    if (!res.ok) throw new Error((j.error && j.error.message) || 'Google returned an error');
    const events = (j.items || []).filter(e => e.status !== 'cancelled').map(e => {
      const s = e.start || {};
      const title = e.summary || '(no title)';
      if (s.dateTime) {
        const d = new Date(s.dateTime);
        return {
          id: 'g_' + e.id,
          date: `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`,
          time: `${p2(d.getHours())}:${p2(d.getMinutes())}`,
          title,
          source: 'google'
        };
      }
      return { id: 'g_' + e.id, date: s.date, time: '', title, source: 'google' };
    });
    return { events };
  } catch (e) {
    return { error: niceError(e) };
  }
});

// ---------- Quick actions (top bar) ----------
ipcMain.handle('quick-action', async (event, action) => {
  const run = (cmd, args) => execFile(cmd, args, { windowsHide: true }, () => {});
  const win = BrowserWindow.fromWebContents(event.sender);
  const confirm = async text => {
    const r = await dialog.showMessageBox(win, { type: 'question', buttons: ['Cancel', 'Yes'], defaultId: 0, cancelId: 0, title: 'Zaal', message: text });
    return r.response === 1;
  };
  if (process.platform === 'linux') {
    // Tries each command until one works, since desktops differ
    const tryRun = list => {
      if (!list.length) return;
      execFile(list[0][0], list[0][1], err => { if (err) tryRun(list.slice(1)); });
    };
    switch (action) {
      case 'lock': tryRun([['loginctl', ['lock-session']], ['xdg-screensaver', ['lock']], ['gnome-screensaver-command', ['-l']]]); break;
      case 'sleep': tryRun([['systemctl', ['suspend']]]); break;
      case 'restart': if (await confirm('Restart the PC now?')) tryRun([['systemctl', ['reboot']]]); break;
      case 'shutdown': if (await confirm('Shut down the PC now?')) tryRun([['systemctl', ['poweroff']]]); break;
      case 'taskmgr': tryRun(['gnome-system-monitor', 'plasma-systemmonitor', 'ksysguard', 'mate-system-monitor', 'xfce4-taskmanager', 'lxtask'].map(c => [c, []])); break;
    }
    return true;
  }
  switch (action) {
    case 'lock': run('rundll32.exe', ['user32.dll,LockWorkStation']); break;
    case 'sleep': run('rundll32.exe', ['powrprof.dll,SetSuspendState', '0,1,0']); break;
    case 'restart': if (await confirm('Restart the PC now?')) run('shutdown', ['/r', '/t', '0']); break;
    case 'shutdown': if (await confirm('Shut down the PC now?')) run('shutdown', ['/s', '/t', '0']); break;
    case 'taskmgr': shell.openPath(path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'Taskmgr.exe')); break;
  }
  return true;
});

// ---------- Weather (Open-Meteo, no account needed) ----------
const weatherError = e => (e.message === 'fetch failed' ? 'Could not reach the weather service' : e.message);

ipcMain.handle('weather-geocode', async (event, name) => {
  try {
    const res = await fetch('https://geocoding-api.open-meteo.com/v1/search?' + new URLSearchParams({ name, count: '1', language: 'en', format: 'json' }));
    const j = await res.json();
    const p = j.results && j.results[0];
    if (!p) return { error: 'City not found' };
    return { name: p.name + (p.country ? ', ' + p.country : ''), lat: p.latitude, lon: p.longitude };
  } catch (e) {
    return { error: weatherError(e) };
  }
});

ipcMain.handle('weather-now', async (event, lat, lon) => {
  try {
    const res = await fetch('https://api.open-meteo.com/v1/forecast?' + new URLSearchParams({
      latitude: String(lat),
      longitude: String(lon),
      current: 'temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m',
      daily: 'temperature_2m_max,temperature_2m_min',
      timezone: 'auto',
      forecast_days: '1'
    }));
    const j = await res.json();
    if (!j.current) throw new Error(j.reason || 'No weather data');
    return {
      temp: j.current.temperature_2m,
      feels: j.current.apparent_temperature,
      humidity: j.current.relative_humidity_2m,
      wind: j.current.wind_speed_10m,
      code: j.current.weather_code,
      hi: j.daily.temperature_2m_max[0],
      lo: j.daily.temperature_2m_min[0]
    };
  } catch (e) {
    return { error: weatherError(e) };
  }
});

app.whenReady().then(() => {
  // If "launch with Windows" was on under the old folder name, move that entry to the new folder
  try {
    const oldPath = path.join(path.dirname(app.getAppPath()), 'PC-manager');
    if (!app.isPackaged && oldPath.toLowerCase() !== app.getAppPath().toLowerCase()) {
      const old = { path: process.execPath, args: [oldPath] };
      if (app.getLoginItemSettings(old).openAtLogin) {
        app.setLoginItemSettings({ ...old, openAtLogin: false });
        app.setLoginItemSettings({ ...loginOpts(), openAtLogin: true });
      }
    }
  } catch (e) { /* not important */ }
  createWindow();
});
app.on('window-all-closed', () => app.quit());
