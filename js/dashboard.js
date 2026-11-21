// ==========================================================
// dashboard.js - live CPU / RAM / battery / temperature rings and the drives list.
// ==========================================================

const RING_LENGTH = 2 * Math.PI * 50;

function ring(id, pct) {
  const circle = $(id);
  circle.style.strokeDasharray = RING_LENGTH;
  circle.style.strokeDashoffset = RING_LENGTH * (1 - Math.min(Math.max(pct, 0), 100) / 100);
}

function fmtSize(bytes) {
  const gb = bytes / 1073741824;
  return gb >= 1000 ? (gb / 1024).toFixed(2) + ' TB' : gb.toFixed(1) + ' GB';
}

function renderDrives(list) {
  const box = $('drives');
  box.innerHTML = '';
  (list || []).forEach(dv => {
    const pct = dv.size ? (dv.used / dv.size) * 100 : 0;
    const card = el('div', 'drive');

    const head = el('div', 'dh');
    head.append(el('b', '', dv.name), el('span', '', Math.round(pct) + '% full'));

    const bar = el('div', 'dbar');
    const fill = el('i', pct >= 90 ? 'full' : '');
    fill.style.width = pct + '%';
    bar.append(fill);

    const info = fmtSize(dv.used) + ' used of ' + fmtSize(dv.size) + '  |  ' + fmtSize(dv.size - dv.used) + ' free';
    card.append(head, bar, el('div', 'muted', info));
    box.append(card);
  });
}

// ---------- Battery health ----------
function updateBatteryHealth(s) {
  const bar = $('bh-bar');
  if (!s.batteryHas) {
    $('bh-val').textContent = 'N/A';
    bar.style.width = '0%';
    $('bh-sub').textContent = 'No battery found (desktop PC?)';
    $('bh-more').textContent = '';
    return;
  }
  if (s.batteryDesigned > 0 && s.batteryMax > 0) {
    const pct = Math.min(100, (s.batteryMax / s.batteryDesigned) * 100);
    $('bh-val').textContent = Math.round(pct) + '%';
    bar.style.width = pct + '%';
    $('bh-sub').textContent = (s.batteryMax / 1000).toFixed(1) + ' Wh now, ' + (s.batteryDesigned / 1000).toFixed(1) + ' Wh when new';
  } else {
    $('bh-val').textContent = 'N/A';
    bar.style.width = '0%';
    $('bh-sub').textContent = 'Your PC does not report battery capacity';
  }
  const more = [];
  if (s.batteryCycles > 0) more.push(s.batteryCycles + ' charge cycles');
  if (s.batteryRemaining > 0 && !s.charging) more.push(Math.floor(s.batteryRemaining / 60) + 'h ' + (s.batteryRemaining % 60) + 'm left');
  $('bh-more').textContent = more.join('  |  ');
}

// ---------- GPU ----------
function updateGpu(gpu) {
  if (gpu && gpu.load !== null) {
    ring('b-gpu', gpu.load);
    $('v-gpu').textContent = Math.round(gpu.load) + '%';
  } else {
    ring('b-gpu', 0);
    $('v-gpu').textContent = 'N/A';
  }
  $('s-gpu').textContent = (gpu && gpu.name) || 'Not readable yet';
}

// ---------- Internet: download, upload, Wi-Fi ----------
const netPeak = { dl: 1, ul: 1 }; // highest speed seen (Mbps), used for the ring when the Wi-Fi speed is unknown

function showSpeed(key, bytesPerSec, capMbps) {
  const mbps = (bytesPerSec * 8) / 1e6;
  netPeak[key] = Math.max(netPeak[key], mbps);
  ring('b-' + key, (mbps / (capMbps || netPeak[key])) * 100);
  $('v-' + key).textContent = mbps >= 100 ? String(Math.round(mbps)) : mbps >= 10 ? mbps.toFixed(1) : mbps.toFixed(2);
  $('s-' + key).textContent = 'Mbps  |  ' + (bytesPerSec / 1e6).toFixed(2) + ' MB/s';
}

function updateNetwork(net, wifi) {
  const cap = wifi && wifi.speed;
  showSpeed('dl', net.down, cap);
  showSpeed('ul', net.up, cap);

  if (wifi && wifi.speed) {
    ring('b-wf', wifi.quality || 0); // the ring shows signal strength
    $('v-wf').textContent = String(Math.round(wifi.speed));
    $('l-wf').textContent = wifi.ssid || 'Wi-Fi';
    $('s-wf').textContent = 'Mbps  |  ' + Math.round(wifi.quality || 0) + '% signal';
  } else {
    ring('b-wf', 0);
    $('v-wf').textContent = 'N/A';
    $('l-wf').textContent = 'Wi-Fi';
    $('s-wf').textContent = 'No Wi-Fi connected';
  }
}

async function updateStats() {
  const s = await window.pc.getStats();
  $('cpuname').textContent = s.cpuName;

  // CPU
  ring('b-cpu', s.cpuLoad);
  $('v-cpu').textContent = Math.round(s.cpuLoad) + '%';

  // RAM
  const ramPct = (s.memUsed / s.memTotal) * 100;
  ring('b-ram', ramPct);
  $('v-ram').textContent = Math.round(ramPct) + '%';
  $('s-ram').textContent = (s.memUsed / 1073741824).toFixed(1) + ' / ' + (s.memTotal / 1073741824).toFixed(1) + ' GB';

  // Battery
  if (s.batteryHas) {
    ring('b-bat', s.batteryPct);
    $('v-bat').textContent = Math.round(s.batteryPct) + '%';
    $('s-bat').textContent = s.charging ? 'Charging' : 'On battery';
  } else {
    ring('b-bat', 0);
    $('v-bat').textContent = 'N/A';
    $('s-bat').textContent = 'No battery found';
  }

  // Temperature
  if (s.temp && s.temp > 0) {
    ring('b-tmp', s.temp);
    $('v-tmp').textContent = Math.round(s.temp) + '\u00b0';
    $('s-tmp').textContent = 'System';
  } else {
    ring('b-tmp', 0);
    $('v-tmp').textContent = 'N/A';
    $('s-tmp').textContent = 'Not readable yet';
  }

  renderDrives(s.drives);
  updateGpu(s.gpu);
  updateNetwork(s.net, s.wifi);
  updateBatteryHealth(s);
  setUptime(s.uptime);
}

function startDashboard() {
  updateStats();
  setInterval(updateStats, 1500);
}
