// ==========================================================
// drawer.js - the pull-out Today panel on the left:
// greeting, PC uptime, today's holidays + events, and your open tasks.
// ==========================================================

function greetingFor(hour) {
  if (hour < 5) return 'Good night';
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function fmtUptime(sec) {
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return (d ? d + 'd ' : '') + (d || h ? h + 'h ' : '') + m + 'm';
}

// Called from the dashboard every time the stats refresh
function setUptime(sec) {
  $('uptime').textContent = 'PC on for ' + fmtUptime(sec);
}

function renderToday() {
  if (!$('today-events')) return;
  const now = new Date();

  $('greet').textContent = greetingFor(now.getHours());
  // Today's date in your default calendar; the American date underneath when it is a different one
  const sys = data.settings.calendar;
  $('today-date').textContent = fmtCalDate(sys, now, true);
  $('today-alt').textContent = sys === 'american' ? '' : now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  // Holidays (follows the options in Settings -> Calendar)
  const hol = $('today-hol');
  hol.innerHTML = '';
  holidaysFor(new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12))
    .forEach(h => hol.append(el('span', 'gtag hbadge', h)));

  // Today's events, sorted by time
  const events = $('today-events');
  events.innerHTML = '';
  const evs = calEvents()
    .filter(e => e.date === iso(now))
    .sort((a, b) => (a.time || '').localeCompare(b.time || ''));
  if (!evs.length) events.append(el('li', 'muted', 'No events today.'));
  evs.forEach(e => {
    const li = el('li', 'item');
    li.append(el('span', 'muted', fmtTime(e.time)), el('span', 't', e.title));
    if (e.source === 'task') li.append(el('span', 'gtag task', 'Task'));
    events.append(li);
  });

  // First 5 open tasks
  const tasks = $('today-tasks');
  tasks.innerHTML = '';
  const open = sortedTasks().filter(t => !t.done);
  if (!open.length) tasks.append(el('li', 'muted', 'Nothing left to do.'));
  open.slice(0, 5).forEach(t => {
    const li = el('li', 'item');
    li.append(el('span', 't', t.text));
    tasks.append(li);
  });
  if (open.length > 5) tasks.append(el('li', 'muted', '+' + (open.length - 5) + ' more'));
}

function setDrawer(open) {
  document.body.classList.toggle('drawer-open', open);
  $('drawer-toggle').innerHTML = icon(open ? 'right' : 'left');
}

function initDrawer() {
  $('drawer-toggle').onclick = () => {
    const open = !document.body.classList.contains('drawer-open');
    setDrawer(open);
    data.settings.drawer = open;
    save();
  };
}

function startDrawer() {
  setDrawer(!!data.settings.drawer);
  renderToday();
  setInterval(renderToday, 60 * 1000); // keeps the greeting and "today" fresh
}
