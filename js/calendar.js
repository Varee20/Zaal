// ==========================================================
// calendar.js - the Calendar page (month grid + events of the selected day).
// Needs core.js, holidays.js, calsys.js and tasks.js (task deadlines show up here too).
// The months follow your default calendar (Settings -> Calendar): American, Persian or Islamic.
// Dots under a day: copper = event, blue = task deadline.
// Event rows can be swiped: your own events get Snooze, Tomorrow and Delete; task deadlines get the task actions.
// ==========================================================

const WEEK_START = 6; // 6 = Saturday, 1 = Monday, 0 = Sunday

let viewAnchor = new Date(); // any day inside the month that is shown
let selDay = iso(new Date());

function renderCal() {
  const sys = data.settings.calendar;
  const first = monthFirst(sys, viewAnchor);
  const info = calParts(sys, first);
  const length = monthLength(sys, first);
  $('c-title').textContent = monthNames(sys)[info.m - 1] + ' ' + info.y;

  const grid = $('c-grid');
  grid.innerHTML = '';

  // Weekday names, starting from WEEK_START (7 Jan 2024 was a Sunday)
  for (let i = 0; i < 7; i++) {
    const d = new Date(2024, 0, 7 + WEEK_START + i);
    grid.append(el('div', 'dow', d.toLocaleDateString(langLocale('gregory'), { weekday: 'short' })));
  }

  // Empty cells before the 1st, then one button per day of the month
  const offset = (first.getDay() - WEEK_START + 7) % 7;
  for (let i = 0; i < offset; i++) grid.append(el('div'));

  const events = calEvents();
  const todayIso = iso(new Date());
  for (let n = 0; n < length; n++) {
    const date = addDays(first, n); // the real (American) date of this day
    const key = iso(date);
    const hols = holidaysFor(date);

    const cls = 'day' + (key === todayIso ? ' today' : '') + (key === selDay ? ' sel' : '') + (hols.length ? ' hol' : '');
    const b = el('button', cls, String(n + 1));
    if (hols.length) b.append(el('span', 'hdot'));

    const dayEvents = events.filter(e => e.date === key);
    const hasEvent = dayEvents.some(e => e.source !== 'task');
    const hasTask = dayEvents.some(e => e.source === 'task');
    if (hasEvent || hasTask) {
      const dots = el('span', 'dots');
      if (hasEvent) dots.append(el('span', 'dot'));
      if (hasTask) dots.append(el('span', 'dot task'));
      b.append(dots);
    }

    b.onclick = () => { selDay = key; renderCal(); };
    grid.append(b);
  }

  renderEvents();
}

// ---------- Moving and removing your own events ----------
function snoozeEvent(ev) {
  if (!ev.time) return;
  const [y, m, d] = ev.date.split('-').map(Number);
  const [hh, mm] = ev.time.split(':').map(Number);
  const when = new Date(y, m - 1, d, hh, mm + 60);
  ev.date = iso(when);
  ev.time = hhmmOf(when);
  save();
  renderCal();
  toast(tr('toast.snoozed'));
}

function tomorrowEvent(ev) {
  ev.date = isoPlus(ev.date, 1);
  save();
  renderCal();
  toast(tr('toast.tomorrow'));
}

function deleteEvent(ev) {
  data.events = data.events.filter(k => k.id !== ev.id);
  save();
  renderCal();
  toast(tr('toast.deleted'));
}

function eventSwipeCfg(ev) {
  const left = [];
  if (ev.time) left.push({ label: tr('sw.snooze'), icon: 'clock', fn: () => snoozeEvent(ev) });
  left.push({ label: tr('sw.tomorrow'), icon: 'cal', fn: () => tomorrowEvent(ev) });
  left.push({ label: tr('delete'), icon: 'trash', cls: 'danger', fn: () => deleteEvent(ev) });
  return { left };
}

// One event as a list row (used here and in the dashboard widgets)
function eventRow(ev) {
  const row = el('div', 'item');
  row.append(el('span', 'muted', fmtTime(ev.time)), el('span', 't', ev.title));

  if (ev.source === 'task') {
    row.append(el('span', 'gtag task', tr('tag.task')));
    row.classList.add('clickable');
    row.title = tr('cal.openTasks');
    row.onclick = () => showView('tasks');
    const task = data.tasks.find(k => k.id === ev.taskId);
    return swipeRow(row, task ? taskSwipeCfg(task) : {});
  }
  if (ev.source === 'google') {
    row.append(el('span', 'gtag', tr('tag.google'))); // Google events are read-only
    return swipeRow(row, {});
  }
  const remove = el('button', 'x');
  remove.innerHTML = icon('close');
  remove.title = tr('delete');
  remove.onclick = () => deleteEvent(ev);
  row.append(remove);
  return swipeRow(row, eventSwipeCfg(ev));
}

function renderEvents() {
  const [y, m, d] = selDay.split('-').map(Number);
  const day = new Date(y, m - 1, d, 12);
  $('e-title').textContent = fmtCalDate(data.settings.calendar, day);

  const list = $('e-list');
  list.innerHTML = '';

  // Holidays first
  holidaysFor(day).forEach(h => {
    const li = el('li', 'item');
    li.append(el('span', 'gtag hbadge', tr('cal.holiday')), el('span', 't', h));
    list.append(li);
  });

  // Then events and task deadlines, sorted by time
  const evs = calEvents()
    .filter(e => e.date === selDay)
    .sort((a, b) => (a.time || '').localeCompare(b.time || ''));
  if (!evs.length) list.append(el('li', 'muted', tr('cal.noEvents')));
  evs.forEach(e => list.append(eventRow(e)));
}

function addEvent() {
  const title = $('e-in').value.trim();
  if (!title) return;
  data.events.push({ id: newId(), date: selDay, time: timeFromBoxes($('e-hh'), $('e-mm'), $('e-ap')), title });
  $('e-in').value = '';
  $('e-hh').value = '';
  $('e-mm').value = '';
  save();
  renderCal();
}

// Previous / next month in the chosen calendar
function shiftMonth(delta) {
  const sys = data.settings.calendar;
  const first = monthFirst(sys, viewAnchor);
  viewAnchor = delta > 0 ? addDays(first, monthLength(sys, first)) : monthFirst(sys, addDays(first, -1));
  renderCal();
}

// Jump to a date (used by the search bar)
function goToDate(dateIso) {
  const [y, m, d] = dateIso.split('-').map(Number);
  selDay = dateIso;
  viewAnchor = new Date(y, m - 1, d, 12);
  renderCal();
}

function initCalendar() {
  $('e-add').onclick = addEvent;
  $('e-in').onkeydown = e => { if (e.key === 'Enter') addEvent(); };
  ['e-hh', 'e-mm'].forEach(id => { $(id).onkeydown = e => { if (e.key === 'Enter') addEvent(); }; });
  $('c-prev').onclick = () => shiftMonth(-1);
  $('c-next').onclick = () => shiftMonth(1);
}
