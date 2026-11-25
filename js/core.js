// ==========================================================
// core.js - shared helpers, app data and page navigation.
// Loaded first: every other file in /js relies on this one.
// ==========================================================

const $ = id => document.getElementById(id);
const pad = n => String(n).padStart(2, '0');
const iso = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

// Small helper to build an element: el('div', 'class-name', 'text')
function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

// ---------- App data (saved by js/platform.js: on the phone, inside the app) ----------
const DEFAULT_SETTINGS = {
  calendar: 'american', persian: false, islamic: false, us: false, city: null, theme: 'gold', mode: 'dark', customColor: '#7c5cff',
  lang: 'en',
  notify: { on: true, before: 10, summary: false },                  // reminders (js/notify.js)
  focus: { focus: 25, break: 5, silence: true },                     // focus timer lengths in minutes, and "silence non-critical"
  widgets: {                                                          // dashboard widgets (js/widgets.js): on/off and size s / m / l
    schedule: { on: true, size: 'm' }, next: { on: true, size: 'm' },
    rings: { on: true, size: 'm' }, streak: { on: true, size: 's' }
  }
};

let data = {
  tasks: [], events: [], gcal: [], note: '', pomo: { date: '', count: 0 }, settings: { ...DEFAULT_SETTINGS },
  activity: {},                                       // per day: { tasks, focus, focusMin } - feeds the rings and the streak
  timer: { mode: 'focus', running: false, end: 0, left: 0 },   // the focus timer (js/focus.js)
  screen: { days: {} }                                // screen time per day (js/screentime.js)
};
const allEvents = () => data.events.concat(data.gcal || []); // your events + Google events
const save = () => {
  window.pc.saveData(data);
  if (typeof renderToday === 'function') renderToday();                     // keep the home screen in sync
  if (typeof scheduleNotifications === 'function') scheduleNotifications(); // keep the reminders in sync
};

// ---------- Daily activity: what you finished each day (for the progress rings and the streak) ----------
function logActivity(kind, delta, dateIso, minutes) {
  const key = dateIso || iso(new Date());
  if (!data.activity) data.activity = {};
  const a = data.activity[key] || (data.activity[key] = { tasks: 0, focus: 0, focusMin: 0 });
  a[kind] = Math.max(0, (a[kind] || 0) + delta);
  if (minutes) a.focusMin = Math.max(0, (a.focusMin || 0) + minutes);
}

function activityOn(key) {
  const a = data.activity && data.activity[key];
  return a ? (a.tasks || 0) + (a.focus || 0) : 0;
}

const dayBack = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() - n, 12);

// Days in a row with something finished. Today still counts as "not over yet", so the streak survives until midnight.
function streakDays() {
  let d = new Date();
  let n = 0;
  if (!activityOn(iso(d))) d = dayBack(d, 1);
  while (activityOn(iso(d)) > 0) { n++; d = dayBack(d, 1); }
  return n;
}

function bestStreak() {
  const keys = Object.keys(data.activity || {}).filter(k => activityOn(k) > 0).sort();
  let best = 0, run = 0, prev = null;
  keys.forEach(k => {
    const [y, m, d] = k.split('-').map(Number);
    const cur = new Date(y, m - 1, d, 12);
    run = prev && iso(dayBack(cur, 1)) === iso(prev) ? run + 1 : 1;
    best = Math.max(best, run);
    prev = cur;
  });
  return Math.max(best, streakDays());
}

// ---------- Page navigation ----------
function showView(v) {
  document.querySelectorAll('nav button').forEach(x => x.classList.toggle('on', x.dataset.v === v));
  document.querySelectorAll('.view').forEach(x => x.classList.toggle('on', x.id === v));
  if (typeof setNav === 'function') setNav(false); // picking a page closes the menu drawer
  if (typeof stSetView === 'function') stSetView(v); // screen time counts per page
  if (v === 'screen' && typeof renderScreenTime === 'function') {
    renderScreenTime();
    if (typeof stRefreshPhone === 'function') stRefreshPhone().then(renderScreenTime); // phone-wide numbers
  }
}
document.querySelectorAll('nav button').forEach(b => { b.onclick = () => showView(b.dataset.v); });

// ---------- Time helpers (used by events and tasks) ----------
// "14:30" -> "2:30 PM" (no time means all-day)
function fmtTime(t) {
  if (!t) return window.t('allDay');
  const [h, m] = t.split(':').map(Number);
  return (h % 12 || 12) + ':' + pad(m) + ' ' + (h >= 12 ? 'PM' : 'AM');
}

// Hour / minute / AM-PM boxes -> "HH:MM" (24h), or "" when no hour was entered
function timeFromBoxes(hh, mm, ap) {
  const h12 = parseInt(hh.value, 10);
  if (isNaN(h12) || h12 < 1 || h12 > 12) return '';
  const min = Math.min(Math.max(parseInt(mm.value, 10) || 0, 0), 59);
  let h = h12 % 12;
  if (ap.value === 'PM') h += 12;
  return pad(h) + ':' + pad(min);
}

// "14:30" -> fills the hour / minute / AM-PM boxes ("" clears them)
function timeToBoxes(t, hh, mm, ap) {
  if (!t) { hh.value = ''; mm.value = ''; ap.value = 'AM'; return; }
  const [h, m] = t.split(':').map(Number);
  hh.value = String(h % 12 || 12);
  mm.value = pad(m);
  ap.value = h >= 12 ? 'PM' : 'AM';
}
