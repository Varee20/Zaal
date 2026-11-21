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

// ---------- App data (saved to disk through main.js) ----------
const DEFAULT_SETTINGS = { calendar: 'american', persian: false, islamic: false, us: false, drawer: false, city: null, aiIntro: false, aiModel: '' };

let data = { tasks: [], events: [], gcal: [], note: '', pomo: { date: '', count: 0 }, settings: { ...DEFAULT_SETTINGS } };
const allEvents = () => data.events.concat(data.gcal || []); // your events + Google events
const save = () => {
  window.pc.saveData(data);
  if (typeof renderToday === 'function') renderToday(); // keep the Today panel in sync
};

// ---------- Page navigation ----------
function showView(v) {
  document.querySelectorAll('nav button').forEach(x => x.classList.toggle('on', x.dataset.v === v));
  document.querySelectorAll('.view').forEach(x => x.classList.toggle('on', x.id === v));
  if (v === 'dash' && typeof updateStats === 'function') updateStats(); // refresh right away when you come back to the Dashboard
}
document.querySelectorAll('nav button').forEach(b => { b.onclick = () => showView(b.dataset.v); });

// ---------- Time helpers (used by events and tasks) ----------
// "14:30" -> "2:30 PM" (no time means all-day)
function fmtTime(t) {
  if (!t) return 'all day';
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
  mm.value = String(m);
  ap.value = h >= 12 ? 'PM' : 'AM';
}
