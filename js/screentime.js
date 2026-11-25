// ==========================================================
// screentime.js - the Screen time tab.
//
// Two sources:
//   "Zaal Mini"  - the seconds Zaal Mini itself is open and on screen, per day and per page (always available, last 60 days kept)
//   "All apps"   - phone-wide screen time from Android (only in the installed phone app, after you allow "Usage access")
// ==========================================================

const ST_PAGES = { dash: 'nav.dash', tasks: 'nav.tasks', cal: 'nav.cal', focus: 'nav.focus', screen: 'nav.screen', settings: 'nav.settings' };
const ST_KEEP_DAYS = 60;

let stPage = 'dash';        // the page that is open right now
let stLast = Date.now();    // the last moment we counted up to
let stVisible = !document.hidden;
let stSaved = Date.now();
let stPhone = null;         // phone-wide result: null = not available here, { granted: false } or { granted: true, days, apps }

function stDay(key) {
  if (!data.screen) data.screen = { days: {} };
  const k = key || iso(new Date());
  return data.screen.days[k] || (data.screen.days[k] = { t: 0, o: 0, v: {} });
}

// Adds the time since the last count to today and to the open page
function stCount() {
  const now = Date.now();
  if (stVisible) {
    const ms = Math.min(now - stLast, 60000); // a long gap means the phone slept, don't count it
    if (ms > 0) {
      const day = stDay();
      day.t += ms / 1000;
      day.v[stPage] = (day.v[stPage] || 0) + ms / 1000;
    }
  }
  stLast = now;
}

function stFlush() {
  stSaved = Date.now();
  const cut = iso(dayBack(new Date(), ST_KEEP_DAYS));
  Object.keys(data.screen.days).forEach(k => { if (k < cut) delete data.screen.days[k]; });
  window.pc.saveData(data); // not save(): this must not redraw the whole app every few seconds
}

// Called by showView when you change page
function stSetView(v) {
  if (!data.screen) return;
  stCount();
  stPage = v;
}

function fmtDur(sec) {
  const m = Math.round(sec / 60);
  const h = Math.floor(m / 60);
  return h > 0 ? tr('fmt.hm', { h, m: m % 60 }) : tr('fmt.m', { m });
}

// Asks Android for the phone-wide numbers (inside the phone app only)
async function stRefreshPhone() {
  const s = await usageStatus();
  if (!s) { stPhone = null; return; }
  if (!s.granted) { stPhone = { granted: false }; return; }
  const r = await usageData();
  stPhone = r ? { granted: true, days: r.days || [], apps: r.apps || [] } : { granted: false };
}

// Which source is showing: phone-wide when it is available and chosen
const stUsePhone = () => !!(stPhone && stPhone.granted && data.settings.stSource !== 'app');

function renderScreenTime() {
  if (!$('st-total') || !data.screen) return;
  const days = data.screen.days;
  const phone = stUsePhone();

  // Source chips and the "allow usage access" box (phone app only)
  $('st-src').hidden = !(stPhone && stPhone.granted);
  $('st-allow').hidden = !(stPhone && !stPhone.granted);
  $('st-src-phone').classList.toggle('on', phone);
  $('st-src-app').classList.toggle('on', !phone);
  $('st-note').hidden = phone;

  let list = [];          // the 7 bars: { d, sec, today }
  let todaySec = 0;
  let yestSec = null;
  let opens = null;

  if (phone) {
    list = stPhone.days.slice(-7).map((x, i, arr) => {
      const [y, m, d] = x.date.split('-').map(Number);
      return { d: new Date(y, m - 1, d, 12), sec: x.sec, today: i === arr.length - 1 };
    });
    todaySec = list.length ? list[list.length - 1].sec : 0;
    yestSec = list.length > 1 ? list[list.length - 2].sec : null;
  } else {
    const today = days[iso(new Date())] || { t: 0, o: 0, v: {} };
    todaySec = today.t;
    opens = today.o || 0;
    const yest = days[iso(dayBack(new Date(), 1))];
    yestSec = yest ? yest.t : null;
    for (let i = 6; i >= 0; i--) {
      const d = dayBack(new Date(), i);
      list.push({ d, sec: (days[iso(d)] || {}).t || 0, today: i === 0 });
    }
  }

  $('st-total').textContent = fmtDur(todaySec);
  const sub = [];
  if (opens !== null) sub.push(tr('st.opens', { n: opens }));
  if (yestSec !== null) sub.push(tr('st.yesterday', { t: fmtDur(yestSec) }));
  $('st-sub').textContent = sub.join('  |  ');

  // Last 7 days as bars
  const week = $('st-week');
  week.innerHTML = '';
  const max = Math.max(60, ...list.map(x => x.sec));
  const fmt = new Intl.DateTimeFormat(langLocale('gregory'), { weekday: 'short' });
  list.forEach(x => {
    const col = el('div', 'st-col' + (x.today ? ' today' : ''));
    const bar = el('div', 'st-bar');
    bar.style.height = Math.max(4, (x.sec / max) * 100) + '%';
    bar.title = fmtDur(x.sec);
    const track = el('div', 'st-track');
    track.append(bar);
    col.append(el('span', 'st-val', x.sec >= 30 ? String(Math.round(x.sec / 60)) : ''), track, el('span', 'st-day', fmt.format(x.d))); // minutes above each bar
    week.append(col);
  });

  const withData = list.filter(x => x.sec > 0);
  $('st-avg').textContent = withData.length
    ? tr('st.avg', { t: fmtDur(withData.reduce((a, x) => a + x.sec, 0) / withData.length) })
    : tr('st.none');

  // Where today's time went: the most used apps (phone-wide), or the Zaal Mini pages
  const head = $('st-where-h');
  head.dataset.i18n = phone ? 'st.topApps' : 'st.where';
  head.textContent = tr(head.dataset.i18n);

  let rows;
  let total;
  if (phone) {
    rows = stPhone.apps.map(a => ({ name: a.name, sec: a.sec }));
    total = todaySec;
  } else {
    const v = (days[iso(new Date())] || { v: {} }).v;
    rows = Object.keys(ST_PAGES).map(k => ({ name: tr(ST_PAGES[k]), sec: v[k] || 0 })).filter(r => r.sec > 0).sort((a, b) => b.sec - a.sec);
    total = todaySec;
  }
  const tabs = $('st-tabs');
  tabs.innerHTML = '';
  if (!rows.length) tabs.append(el('div', 'muted', tr('st.none')));
  rows.forEach(r => {
    const row = el('div', 'st-row');
    const h = el('div', 'st-head');
    h.append(el('span', '', r.name), el('span', 'muted', fmtDur(r.sec)));
    const bar = el('div', 'dbar');
    const fill = el('i');
    fill.style.width = (total ? Math.min(100, (r.sec / total) * 100) : 0) + '%';
    bar.append(fill);
    row.append(h, bar);
    tabs.append(row);
  });
}

function initScreenTime() {
  $('st-src-phone').onclick = () => { data.settings.stSource = 'phone'; save(); renderScreenTime(); };
  $('st-src-app').onclick = () => { data.settings.stSource = 'app'; save(); renderScreenTime(); };
  $('st-allow-btn').onclick = async () => { const z = zn(); if (z) { try { await z.usageRequestAccess(); } catch (e) { /* ignore */ } } };
}

function startScreenTime() {
  if (!data.screen) data.screen = { days: {} };
  stDay().o++; // this opening of the app
  stLast = Date.now();
  stVisible = !document.hidden;

  stRefreshPhone().then(renderScreenTime);
  let ticks = 0;
  setInterval(() => {
    stCount();
    if (Date.now() - stSaved > 30000) stFlush();
    const page = $('screen');
    if (page && page.classList.contains('on')) {
      if (++ticks % 6 === 0) stRefreshPhone().then(renderScreenTime); // phone-wide numbers: every 30 s while the tab is open
      else renderScreenTime();
    }
  }, 5000);

  document.addEventListener('visibilitychange', () => {
    stCount();
    stVisible = !document.hidden;
    stLast = Date.now();
    if (document.hidden) stFlush();
    else stDay().o++; // opened again
  });
  renderScreenTime();
}
