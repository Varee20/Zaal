// ==========================================================
// dashboard.js - the phone stats: battery, storage and network rings.
// On the phone it asks Android (through Capacitor's Device plugin). In a browser or the
// "npm start" preview it uses what the browser can see, so the cards still work for testing.
// ==========================================================

const RING_LENGTH = 2 * Math.PI * 50;

function ring(id, pct) {
  const circle = $(id);
  circle.style.strokeDasharray = RING_LENGTH;
  circle.style.strokeDashoffset = RING_LENGTH * (1 - Math.min(Math.max(pct, 0), 100) / 100);
}

function fmtSize(bytes) {
  const gb = bytes / 1073741824;
  return gb >= 1000 ? (gb / 1024).toFixed(2) + ' TB' : gb >= 1 ? gb.toFixed(1) + ' GB' : Math.max(bytes / 1048576, 0).toFixed(0) + ' MB';
}

// Capacitor's native plugins only exist inside the installed phone app
function nativePlugin(name) {
  try {
    const C = window.Capacitor;
    if (C && C.isNativePlatform && C.isNativePlatform()) return C.Plugins[name] || null;
  } catch (e) { /* not on a phone */ }
  return null;
}

// ---------- Battery ----------
async function readBattery() {
  const dev = nativePlugin('Device');
  try {
    if (dev && dev.getBatteryInfo) {
      const b = await dev.getBatteryInfo();
      if (typeof b.batteryLevel === 'number') return { pct: b.batteryLevel * 100, charging: !!b.isCharging };
    }
  } catch (e) { /* try the browser way */ }
  try {
    if (navigator.getBattery) {
      const b = await navigator.getBattery();
      return { pct: b.level * 100, charging: b.charging };
    }
  } catch (e) { /* no battery info */ }
  return null;
}

function showBattery(b) {
  if (!b) {
    ring('b-bat', 0);
    $('v-bat').textContent = tr('na');
    $('s-bat').textContent = tr('notReadable');
    return;
  }
  ring('b-bat', b.pct);
  $('v-bat').textContent = Math.round(b.pct) + '%';
  $('s-bat').textContent = b.charging ? tr('charging') : tr('onBattery');
}

// ---------- Storage ----------
async function readStorage() {
  const dev = nativePlugin('Device');
  try {
    if (dev && dev.getInfo) {
      const i = await dev.getInfo();
      const total = i.realDiskTotal || i.diskTotal;
      const free = i.realDiskFree || i.diskFree;
      if (total > 0) return { total, used: total - free, phone: true };
    }
  } catch (e) { /* try the browser way */ }
  try {
    if (navigator.storage && navigator.storage.estimate) {
      const e = await navigator.storage.estimate();
      if (e.quota) return { total: e.quota, used: e.usage || 0, phone: false };
    }
  } catch (e) { /* no storage info */ }
  return null;
}

function showStorage(s) {
  if (!s) {
    ring('b-sto', 0);
    $('v-sto').textContent = tr('na');
    $('s-sto').textContent = tr('notReadable');
    return;
  }
  const pct = s.total ? (s.used / s.total) * 100 : 0;
  ring('b-sto', pct);
  $('v-sto').textContent = Math.round(pct) + '%';
  $('s-sto').textContent = s.phone ? tr('freeOf', { free: fmtSize(s.total - s.used), total: fmtSize(s.total) }) : tr('appData', { n: fmtSize(s.used) }); // the browser can't see the whole phone
}

// ---------- Network ----------
const NET_QUALITY = { 'slow-2g': 15, '2g': 30, '3g': 55, '4g': 100 };

function updateNetwork() {
  const c = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  const online = navigator.onLine !== false && !(c && c.type === 'none');
  const out = $('v-net');
  let label = tr('online');
  if (!online) label = tr('offline');
  else if (c && c.type === 'wifi') label = tr('wifi');
  else if (c && c.type === 'ethernet') label = tr('wired');
  else if (c && c.type === 'cellular') label = c.effectiveType ? c.effectiveType.toUpperCase() : tr('mobile');
  else if (c && c.effectiveType) label = c.effectiveType.toUpperCase();
  out.textContent = label;

  const quality = !online ? 0 : (c && NET_QUALITY[c.effectiveType]) || 100;
  ring('b-net', quality);

  const bits = [];
  if (online && c && c.downlink) bits.push(c.downlink + ' Mbps');
  if (online && c && c.rtt) bits.push(c.rtt + ' ms');
  $('s-net').textContent = !online ? tr('noConn') : bits.join('  |  ') || tr('connected');
}

async function updateStats() {
  const [bat, sto] = await Promise.all([readBattery(), readStorage()]);
  showBattery(bat);
  showStorage(sto);
  updateNetwork();
}

function startDashboard() {
  updateStats();
  // Every 10 seconds is plenty for a phone, and it pauses while the app is in the background
  setInterval(() => { if (!document.hidden) updateStats(); }, 10000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) updateStats(); });
  window.addEventListener('online', updateNetwork);
  window.addEventListener('offline', updateNetwork);
  const c = navigator.connection;
  if (c && c.addEventListener) c.addEventListener('change', updateNetwork);
}
