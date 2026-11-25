// ==========================================================
// native.js - the parts that only work inside the installed Android app (through js/../native/ZaalNativePlugin.java).
// In the browser / "npm start" preview none of this exists, and everything here quietly does nothing.
//   - Do Not Disturb while a focus session runs (focus.js)
//   - phone-wide screen time (screentime.js)
//   - home screen widgets: a snapshot of your day is sent to the phone (below)
// ==========================================================

const zn = () => nativePlugin('ZaalNative');

// ---------- Do Not Disturb ----------
async function dndState() {
  const z = zn();
  if (!z) return null;
  try { return await z.dndStatus(); } catch (e) { return null; }
}

// Switches the phone to "priority only" until the session ends (needs the permission; the Focus tab has a button for it)
async function dndBegin(endMs) {
  const z = zn();
  if (!z) return;
  try {
    const s = await z.dndStatus();
    if (s.granted) await z.dndStart({ end: endMs });
  } catch (e) { /* not important */ }
}

async function dndEnd() {
  const z = zn();
  if (!z) return;
  try { await z.dndStop(); } catch (e) { /* not important */ }
}

// The "Do Not Disturb" row on the Focus tab: only shown inside the phone app
async function refreshDndRow() {
  const row = $('f-dnd');
  if (!row) return;
  const s = await dndState();
  if (!s) { row.hidden = true; return; }
  row.hidden = false;
  $('f-dnd-state').textContent = s.granted ? tr('dnd.ready') : tr('dnd.need');
  $('f-dnd-allow').style.display = s.granted ? 'none' : '';
}

function initNative() {
  const allow = $('f-dnd-allow');
  if (allow) allow.onclick = async () => { const z = zn(); if (z) { try { await z.dndRequestAccess(); } catch (e) { /* ignore */ } } };
  // coming back from Android's settings screens: look again
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) return;
    refreshDndRow();
    if (typeof stRefreshPhone === 'function') stRefreshPhone().then(renderScreenTime);
  });
  refreshDndRow();
}

// ---------- Phone-wide screen time ----------
async function usageStatus() {
  const z = zn();
  if (!z) return null;
  try { return await z.usageStatus(); } catch (e) { return null; }
}

async function usageData() {
  const z = zn();
  if (!z) return null;
  try { return await z.usageGet({ days: 7 }); } catch (e) { return null; }
}

// ---------- Home screen widgets ----------
let widgetTimer = null;
let lastWidgetJson = '';

function widgetSnapshot() {
  const todayIso = iso(new Date());
  const events = calEvents()
    .filter(e => e.date === todayIso)
    .sort((a, b) => (a.time || '').localeCompare(b.time || ''))
    .slice(0, 6)
    .map(e => ({ time: e.time ? fmtTime(e.time) : '', t: e.title }));
  const tasks = sortedTasks()
    .filter(task => !task.done)
    .slice(0, 5)
    .map(task => ({ t: task.text, due: task.date ? fmtDue(task) : '', p: task.priority }));
  const rd = ringData();

  return {
    accent: getComputedStyle(document.documentElement).getPropertyValue('--gold').trim() || '#d4af37',
    hSchedule: tr('wg.schedule'),
    hNext: tr('wg.next'),
    streak: streakDays(),
    streakLabel: tr('wg.dayStreak'),
    emptyE: tr('wg.noEvents'),
    emptyT: tr('wg.noTasks'),
    events,
    tasks,
    rings: rd.rings.map(r => ({ label: r.label, pct: r.pct, text: r.text }))
  };
}

// Called after every change (js/today.js). Waits a moment so a burst of changes is sent once.
function scheduleWidgetPush() {
  if (!zn()) return;
  clearTimeout(widgetTimer);
  widgetTimer = setTimeout(async () => {
    try {
      const json = JSON.stringify(widgetSnapshot());
      if (json === lastWidgetJson) return;
      lastWidgetJson = json;
      await zn().setWidgetData({ json });
    } catch (e) { /* widgets are best effort */ }
  }, 1500);
}
