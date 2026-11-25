// ==========================================================
// widgets.js - the smart widgets on the Dashboard (home screen), each in three sizes (S / M / L):
//   Today's schedule  - your events and task deadlines for today
//   Next tasks        - the next open tasks (the top 3 in M and L)
//   Today's progress  - progress rings: tasks done, focus sessions, active days this week
//   Streak            - days in a row with a finished task or focus session
// Turn them on or off and pick the size in Settings -> Dashboard widgets. Rows can be swiped like everywhere else.
// ==========================================================

const WIDGET_KEYS = ['schedule', 'next', 'rings', 'streak'];
const WIDGET_TITLES = { schedule: 'wg.schedule', next: 'wg.next', rings: 'wg.progress', streak: 'wg.streak' };
const FOCUS_GOAL = 4; // focus sessions per day that fill the focus ring

// ---------- Schedule ----------
function wgSchedule(size) {
  const box = el('div', 'wg-body');
  const todayIso = iso(new Date());
  const evs = calEvents()
    .filter(e => e.date === todayIso)
    .sort((a, b) => (a.time || '').localeCompare(b.time || ''));
  if (!evs.length) { box.append(el('div', 'muted wg-empty', tr('wg.noEvents'))); return box; }

  let list = evs;
  if (size === 's') { // small: just what is coming up next
    const now = hhmmOf(new Date());
    list = [evs.find(e => e.time && e.time >= now) || evs[0]];
  }
  const limit = size === 'l' ? 8 : size === 'm' ? 3 : 1;
  const shown = list.slice(0, limit);
  const ul = el('ul', 'list wg-list');
  shown.forEach(e => ul.append(eventRow(e)));
  box.append(ul);
  if (evs.length > shown.length) box.append(el('div', 'muted wg-more', tr('wg.more', { n: evs.length - shown.length })));
  return box;
}

// ---------- Next tasks ----------
function miniTask(task, detailed) {
  const card = el('div', 'item task mini p' + task.priority);
  const top = el('div', 'task-top');
  const check = el('input');
  check.type = 'checkbox';
  check.checked = task.done;
  check.onchange = () => { setTaskDone(task, check.checked); tasksChanged(); };
  top.append(check, el('span', 't', task.text));
  card.append(top);

  const meta = el('div', 'task-meta');
  if (task.date) {
    const due = el('span', 'due', tr('due', { d: fmtDue(task) }));
    const when = taskDue(task);
    if (when && when < new Date()) due.classList.add('late');
    meta.append(due);
  }
  if (detailed && task.category) meta.append(el('span', 'gtag cat', task.category));
  if (detailed && task.subs.length) meta.append(el('span', '', tr('subCount', { a: task.subs.filter(s => s.done).length, b: task.subs.length })));
  if (meta.children.length) card.append(meta);
  return swipeRow(card, taskSwipeCfg(task));
}

function wgNext(size) {
  const box = el('div', 'wg-body');
  const open = sortedTasks().filter(task => !task.done);
  if (!open.length) { box.append(el('div', 'muted wg-empty', tr('wg.noTasks'))); return box; }
  const limit = size === 's' ? 1 : 3;
  const ul = el('ul', 'list wg-list');
  open.slice(0, limit).forEach(task => ul.append(miniTask(task, size === 'l')));
  box.append(ul);
  if (open.length > limit) box.append(el('div', 'muted wg-more', tr('wg.more', { n: open.length - limit })));
  return box;
}

// ---------- Progress rings ----------
function ringBlock(r) {
  const d = el('div', 'wg-ring');
  d.innerHTML = '<div class="ring"><svg viewBox="0 0 120 120"><circle class="track" cx="60" cy="60" r="50"/><circle class="bar" cx="60" cy="60" r="50"/></svg><div class="val"></div></div><div class="wg-label"></div>';
  const bar = d.querySelector('.bar');
  bar.style.stroke = r.color;
  bar.style.strokeDasharray = RING_LENGTH;
  bar.style.strokeDashoffset = RING_LENGTH * (1 - Math.min(100, Math.max(0, r.pct)) / 100);
  d.querySelector('.val').textContent = r.text;
  d.querySelector('.wg-label').textContent = r.label;
  return d;
}

// The numbers behind the three rings (also sent to the home screen widgets)
function ringData() {
  const todayIso = iso(new Date());
  const day = (data.activity && data.activity[todayIso]) || {};

  const doneN = day.tasks || 0;
  const dueLeft = data.tasks.filter(task => !task.done && task.date && task.date <= todayIso).length; // due today or late
  const totalN = doneN + dueLeft;
  const focusN = day.focus || 0;
  let weekDays = 0;
  for (let i = 0; i < 7; i++) if (activityOn(iso(dayBack(new Date(), i))) > 0) weekDays++;

  const rings = [
    { label: tr('wg.rTasks'), pct: totalN ? (doneN / totalN) * 100 : 0, text: totalN ? doneN + '/' + totalN : '0', color: 'var(--gold)' },
    { label: tr('wg.rFocus'), pct: (focusN / FOCUS_GOAL) * 100, text: focusN + '/' + FOCUS_GOAL, color: 'var(--silver)' },
    { label: tr('wg.rWeek'), pct: (weekDays / 7) * 100, text: weekDays + '/7', color: 'var(--champagne)' }
  ];
  return { rings, doneN, focusN, focusMin: day.focusMin || 0 };
}

function wgRings(size) {
  const box = el('div', 'wg-body');
  const { rings, doneN, focusN, focusMin } = ringData();
  const row = el('div', 'wg-rings');
  (size === 's' ? rings.slice(0, 1) : rings).forEach(r => row.append(ringBlock(r)));
  box.append(row);
  if (size === 'l') box.append(el('div', 'muted wg-sum', tr('wg.sum', { t: doneN, s: focusN, m: focusMin })));
  return box;
}

// ---------- Streak ----------
function wgStreak(size) {
  const box = el('div', 'wg-body');
  const n = streakDays();

  const big = el('div', 'wg-streak');
  const flame = el('span', 'flame' + (n ? ' lit' : ''));
  flame.innerHTML = icon('flame');
  big.append(flame, el('b', '', String(n)), el('span', 'muted', tr('wg.dayStreak')));
  box.append(big);

  if (size !== 's') {
    const dots = el('div', 'wg-dots');
    const fmt = new Intl.DateTimeFormat(langLocale('gregory'), { weekday: 'narrow' });
    for (let i = 6; i >= 0; i--) {
      const d = dayBack(new Date(), i);
      const dot = el('div', 'wg-dot' + (activityOn(iso(d)) > 0 ? ' on' : '') + (i === 0 ? ' today' : ''));
      dot.append(el('i'), el('span', '', fmt.format(d)));
      dots.append(dot);
    }
    box.append(dots);
  }
  if (size === 'l') {
    box.append(el('div', 'wg-best', tr('wg.best', { n: bestStreak() })));
    box.append(el('div', 'muted wg-sum', tr('wg.hint')));
  }
  return box;
}

const WIDGET_BUILD = { schedule: wgSchedule, next: wgNext, rings: wgRings, streak: wgStreak };

function renderWidgets() {
  const box = $('widgets');
  if (!box || !data.settings.widgets) return;
  if (document.querySelector('.swrap.swiping')) return; // never redraw under a finger
  box.innerHTML = '';
  WIDGET_KEYS.forEach(key => {
    const cfg = data.settings.widgets[key];
    if (!cfg || !cfg.on) return;
    const size = ['s', 'm', 'l'].includes(cfg.size) ? cfg.size : 'm';
    const w = el('div', 'wg wg-' + key + ' size-' + size);
    w.append(el('div', 'wg-h', tr(WIDGET_TITLES[key])), WIDGET_BUILD[key](size));
    box.append(w);
  });
}
