// ==========================================================
// ollama.js - runs in the main process.
// Finds Ollama on this PC, installs it (only after the user agreed inside Zaal),
// downloads a small AI model, and passes chat messages to it.
// Ollama is a free program that runs AI models on your own PC, so nothing goes online.
// ==========================================================

const os = require('os');
const path = require('path');
const fs = require('fs');
const { execFile, spawn } = require('child_process');

const HOST = 'http://127.0.0.1:11434';
const INSTALLER_URL = 'https://ollama.com/download/OllamaSetup.exe';
const GB = 1024 ** 3;

const sleep = ms => new Promise(r => setTimeout(r, ms));
const programDir = () => path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Ollama');
const isInstalled = () => fs.existsSync(path.join(programDir(), 'ollama.exe'));

// A model that fits this PC's memory (sizes are approximate)
function suggestedModel() {
  const ram = os.totalmem() / GB;
  if (ram >= 15) return { name: 'qwen3:8b', sizeGB: 5.2 };
  if (ram >= 7) return { name: 'qwen3:4b', sizeGB: 2.5 };
  return { name: 'qwen3:1.7b', sizeGB: 1.4 };
}

function niceError(e) {
  if (e.name === 'AbortError') return 'It took too long to answer';
  if (e.message === 'fetch failed') return 'Could not connect (network problem, or blocked on your connection)';
  return e.message;
}

// Talks to the local Ollama server
async function api(pathname, body, timeoutMs) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs || 3000);
  try {
    return await fetch(HOST + pathname, {
      method: body ? 'POST' : 'GET',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: ctrl.signal
    });
  } finally {
    clearTimeout(timer);
  }
}

// Names of the downloaded models, or null when Ollama is not running
async function installedModels() {
  try {
    const res = await api('/api/tags', null, 1500);
    if (!res.ok) return null;
    const j = await res.json();
    return (j.models || []).map(m => m.name);
  } catch (e) {
    return null;
  }
}

// ---------- Setup steps ----------
async function downloadInstaller(send) {
  const file = path.join(os.tmpdir(), 'OllamaSetup.exe');
  const res = await fetch(INSTALLER_URL, { redirect: 'follow' });
  if (!res.ok || !res.body) throw new Error('Could not download Ollama (error ' + res.status + ')');
  const total = Number(res.headers.get('content-length')) || 0;
  const out = fs.createWriteStream(file);
  let got = 0, lastSent = 0;
  for await (const chunk of res.body) {
    if (!out.write(chunk)) await new Promise(r => out.once('drain', r));
    got += chunk.length;
    const now = Date.now();
    if (now - lastSent > 250) {
      lastSent = now;
      send({ step: 'download', pct: total ? (got / total) * 100 : null, text: Math.round(got / 1e6) + (total ? ' of ' + Math.round(total / 1e6) : '') + ' MB' });
    }
  }
  await new Promise((resolve, reject) => { out.on('finish', resolve); out.on('error', reject); out.end(); });
  return file;
}

// Windows checks that the installer is properly signed and was not changed
function installerIsSigned(file) {
  return new Promise(resolve => {
    const safe = file.replace(/'/g, "''");
    execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', "(Get-AuthenticodeSignature -LiteralPath '" + safe + "').Status"],
      { windowsHide: true, timeout: 60000 },
      (err, stdout) => resolve(!err && String(stdout).trim() === 'Valid'));
  });
}

function runInstaller(file) {
  return new Promise((resolve, reject) => {
    execFile(file, ['/VERYSILENT', '/SUPPRESSMSGBOXES', '/NORESTART', '/SP-'], { windowsHide: true, timeout: 10 * 60 * 1000 }, err => (err ? reject(err) : resolve()));
  });
}

// Make sure the Ollama server is running (the installer normally starts it)
async function ensureRunning() {
  for (let i = 0; i < 4; i++) {
    if ((await installedModels()) !== null) return;
    await sleep(1000);
  }
  const app = path.join(programDir(), 'ollama app.exe');
  const child = fs.existsSync(app)
    ? spawn(app, [], { detached: true, stdio: 'ignore', windowsHide: true })
    : spawn(path.join(programDir(), 'ollama.exe'), ['serve'], { detached: true, stdio: 'ignore', windowsHide: true });
  child.on('error', () => {});
  child.unref();
  for (let i = 0; i < 45; i++) {
    if ((await installedModels()) !== null) return;
    await sleep(1000);
  }
  throw new Error('Ollama is installed but did not start. Try restarting your PC.');
}

async function pullModel(name, send) {
  const res = await fetch(HOST + '/api/pull', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: name, stream: true })
  });
  if (!res.ok || !res.body) throw new Error('Could not start the model download');
  const decoder = new TextDecoder();
  let buf = '';
  for await (const chunk of res.body) {
    buf += decoder.decode(chunk, { stream: true });
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (!line) continue;
      let j;
      try { j = JSON.parse(line); } catch (e) { continue; }
      if (j.error) throw new Error(j.error);
      send({
        step: 'model',
        pct: j.total ? ((j.completed || 0) / j.total) * 100 : null,
        text: j.total ? Math.round((j.completed || 0) / 1e6) + ' of ' + Math.round(j.total / 1e6) + ' MB' : 'Preparing...'
      });
    }
  }
}

// ---------- IPC (what the app window can ask for) ----------
module.exports = function registerOllama(ipcMain) {
  ipcMain.handle('ai-status', async () => {
    const models = await installedModels();
    return {
      running: models !== null,
      installed: isInstalled(),
      models: models || [],
      ramGB: Math.round(os.totalmem() / GB),
      suggested: suggestedModel(),
      supported: process.platform === 'win32'
    };
  });

  // Install (if needed), start, and download the model. Only called after the user pressed "Install and link".
  ipcMain.handle('ai-setup', async (event, model) => {
    const send = p => { try { event.sender.send('ai-progress', p); } catch (e) { /* window closed */ } };
    try {
      let models = await installedModels();
      if (models === null) {
        if (!isInstalled()) {
          send({ step: 'download', pct: 0, text: 'Starting...' });
          const file = await downloadInstaller(send);
          send({ step: 'verify', pct: null, text: 'Please wait...' });
          if (!(await installerIsSigned(file))) {
            fs.unlink(file, () => {});
            throw new Error('The downloaded installer could not be verified, so Zaal did not run it. You can install Ollama yourself from ollama.com/download and then press "Link" again.');
          }
          send({ step: 'install', pct: null, text: 'This can take a minute...' });
          await runInstaller(file);
          fs.unlink(file, () => {});
        }
        send({ step: 'start', pct: null, text: 'Almost there...' });
        await ensureRunning();
        models = await installedModels();
      }
      if (!models || !models.includes(model)) {
        send({ step: 'model', pct: 0, text: 'Starting...' });
        await pullModel(model, send);
      }
      return { ok: true, model };
    } catch (e) {
      return { error: niceError(e) };
    }
  });

  // One chat request. "tools" are the actions the assistant is allowed to ask for.
  ipcMain.handle('ai-chat', async (event, payload) => {
    try {
      const body = {
        model: payload.model,
        messages: payload.messages,
        tools: payload.tools,
        stream: false,
        options: { temperature: 0.2, num_ctx: 8192 }
      };
      if (/^qwen3/.test(payload.model)) body.think = false; // skip the long "thinking" step, much faster
      const res = await api('/api/chat', body, 10 * 60 * 1000);
      const j = await res.json();
      if (!res.ok || j.error) return { error: j.error || 'The assistant returned an error' };
      return { message: j.message };
    } catch (e) {
      return { error: e.message === 'fetch failed' ? 'Could not reach Ollama. Is it running?' : niceError(e) };
    }
  });
};
