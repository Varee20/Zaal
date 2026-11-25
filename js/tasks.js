// ==========================================================
// tasks.js - the Tasks page: deadline, priority, category, subtasks, editing, and swipe actions.
// Tasks with a deadline also show up in the calendar (see taskEvents / calEvents).
// Swipe a task toward the end of the row to finish it; swipe the other way for Snooze, Tomorrow and Priority.
// ==========================================================

let createDate = null;     // the date picker in the "new task" row
let editingId = null;      // the task that is open for editing
let taskFilter = 'All';    // category filter
let refocusSub = null;     // keeps the cursor in the "add subtask" box after adding one

// Older saved tasks only had text + done, so fill in the new fields
function normalizeTask(task) {
  return Object.assign({ date: '', time: '', category: '', priority: 1, subs: [], created: 0, doneAt: 0 }, task);
}

// ---------- Deadlines ----------
function taskDue(task) {
  if (!task.date) return null;
  const [y, m, d] = task.date.split('-').map(Number);
  const [hh, mm] = (task.time || '23:59').split(':').map(Number);
  return new Date(y, m - 1, d, hh, mm);
}

function fmtDue(task) {
  const [y, m, d] = task.date.split('-').map(Number);
  const day = fmtCalDate(data.settings.calendar, new Date(y, m - 1, d, 12));
  return day + (task.time ? ', ' + fmtTime(task.time) : '');
}

// Every open task with a deadline becomes a calendar event (blue dot).
function taskEvents() {
  return data.tasks
    .filter(task => task.date && !task.done)
    .map(task => ({ id: 't_' + task.id, date: task.date, time: task.time, title: task.text, source: 'task', taskId: task.id }));
}
const calEvents = () => allEvents().concat(taskEvents()); // your events + Google + task deadlines

// ---------- Sorting: open first, then priority, then soonest deadline ----------
function compareTasks(a, b) {
  if (a.done !== b.done) return a.done ? 1 : -1;
  if (a.priority !== b.priority) return b.priority - a.priority;
  const da = taskDue(a), db = taskDue(b);
  if (da && db) return da - db;
  if (da) return -1;
  if (db) return 1;
  return b.created - a.created;
}
const sortedTasks = () => data.tasks.slice().sort(compareTasks);

// Save, redraw the list and the calendar (the calendar shows the deadlines)
function tasksChanged() {
  save();
  renderTasks();
  renderCal();
}

// ---------- Finishing, snoozing and moving a task (used by the swipe buttons and the widgets) ----------
const isoPlus = (dateIso, days) => {
  const [y, m, d] = dateIso.split('-').map(Number);
  return iso(new Date(y, m - 1, d + days, 12));
};
const hhmmOf = d => pad(d.getHours()) + ':' + pad(d.getMinutes());

// Marks a task done (or open again) and keeps the daily activity count right
function setTaskDone(task, done) {
  if (task.done === done) return;
  task.done = done;
  if (done) {
    task.doneAt = Date.now();
    logActivity('tasks', 1);
  } else {
    logActivity('tasks', -1, task.doneAt ? iso(new Date(task.doneAt)) : iso(new Date()));
    task.doneAt = 0;
  }
}

// Snooze: one hour later. A task with no time gets a time one hour from now; a future date with no time moves a day.
function snoozeTask(task) {
  const now = new Date();
  if (task.date && task.time) {
    const when = new Date(Math.max(taskDue(task).getTime(), now.getTime()) + 3600000);
    task.date = iso(when);
    task.time = hhmmOf(when);
  } else if (!task.date || task.date <= iso(now)) {
    const when = new Date(now.getTime() + 3600000);
    task.date = iso(when);
    task.time = hhmmOf(when);
  } else {
    task.date = isoPlus(task.date, 1);
  }
  tasksChanged();
  toast(tr('toast.snoozed'));
}

// Reschedule: tomorrow (or one day later than the date it already has). Use Edit for an exact date.
function tomorrowTask(task) {
  const today = iso(new Date());
  task.date = isoPlus(task.date && task.date > today ? task.date : today, 1);
  tasksChanged();
  toast(tr('toast.tomorrow'));
}

function cyclePriority(task) {
  task.priority = (task.priority + 1) % 3;
  tasksChanged();
  toast(tr('toast.prio', { p: tr('prio.' + task.priority) }));
}

// The swipe actions of a task
function taskSwipeCfg(task) {
  return {
    right: task.done
      ? { label: tr('sw.reopen'), icon: 'undo', cls: 'undo', fn: () => { setTaskDone(task, false); tasksChanged(); toast(tr('toast.reopened')); } }
      : { label: tr('sw.done'), icon: 'check', cls: 'ok', fn: () => { setTaskDone(task, true); tasksChanged(); toast(tr('toast.done')); } },
    left: [
      { label: tr('sw.snooze'), icon: 'clock', fn: () => snoozeTask(task) },
      { label: tr('sw.tomorrow'), icon: 'cal', fn: () => tomorrowTask(task) },
      { label: tr('sw.priority'), icon: 'up', fn: () => cyclePriority(task) }
    ]
  };
}

// ---------- Categories ----------
function taskCategories() {
  return [...new Set(data.tasks.map(task => task.category).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function renderCategoryUI() {
  const cats = taskCategories();
  if (taskFilter !== 'All' && !cats.includes(taskFilter)) taskFilter = 'All';

  const box = $('t-filter');
  box.innerHTML = '';
  if (cats.length) {
    ['All', ...cats].forEach(c => {
      const b = el('button', 'chip' + (c === taskFilter ? ' on' : ''), c === 'All' ? tr('all') : c);
      b.onclick = () => { taskFilter = c; renderTasks(); };
      box.append(b);
    });
  }
}

// ---------- One task ----------
function priorityBox(task) {
  const box = el('div', 'prio');
  const up = el('button', 'pbtn');
  const down = el('button', 'pbtn');
  up.innerHTML = icon('up');
  down.innerHTML = icon('down');
  up.title = tr('prio.raise');
  down.title = tr('prio.lower');
  up.disabled = task.priority >= 2;
  down.disabled = task.priority <= 0;
  up.onclick = () => { task.priority = Math.min(2, task.priority + 1); tasksChanged(); };
  down.onclick = () => { task.priority = Math.max(0, task.priority - 1); tasksChanged(); };
  box.append(up, el('span', 'plabel', tr('prio.' + task.priority)), down);
  return box;
}

function taskCard(task) {
  const card = el('div', 'item task p' + task.priority + (task.done ? ' done' : ''));

  // top line: checkbox, title, priority arrows, edit, delete
  const top = el('div', 'task-top');
  const check = el('input');
  check.type = 'checkbox';
  check.checked = task.done;
  check.onchange = () => { setTaskDone(task, check.checked); tasksChanged(); };
  const edit = el('button', 'x edit');
  edit.innerHTML = icon('edit');
  edit.title = tr('edit');
  edit.onclick = () => { editingId = task.id; renderTasks(); };
  const del = el('button', 'x');
  del.innerHTML = icon('close');
  del.title = tr('delete');
  del.onclick = () => {
    if (task.done) logActivity('tasks', -1, task.doneAt ? iso(new Date(task.doneAt)) : iso(new Date()));
    data.tasks = data.tasks.filter(k => k.id !== task.id);
    tasksChanged();
  };
  top.append(check, el('span', 't', task.text), priorityBox(task), edit, del);
  card.append(top);

  // info line: deadline, category, subtask progress
  const meta = el('div', 'task-meta');
  if (task.date) {
    const due = el('span', 'due', tr('due', { d: fmtDue(task) }));
    const when = taskDue(task);
    if (!task.done && when && when < new Date()) due.classList.add('late');
    meta.append(due);
  }
  if (task.category) meta.append(el('span', 'gtag cat', task.category));
  if (task.subs.length) meta.append(el('span', '', tr('subCount', { a: task.subs.filter(s => s.done).length, b: task.subs.length })));
  if (meta.children.length) card.append(meta);

  // subtasks
  if (task.subs.length) {
    const subs = el('ul', 'subs');
    task.subs.forEach(s => {
      const row = el('li', 'sub' + (s.done ? ' done' : ''));
      const c = el('input');
      c.type = 'checkbox';
      c.checked = s.done;
      c.onchange = () => { s.done = c.checked; tasksChanged(); };
      const x = el('button', 'x');
      x.innerHTML = icon('close');
      x.onclick = () => { task.subs = task.subs.filter(k => k.id !== s.id); tasksChanged(); };
      row.append(c, el('span', '', s.text), x);
      subs.append(row);
    });
    card.append(subs);
  }

  // add a subtask
  const add = el('input', 'inp subin');
  add.placeholder = tr('addSub');
  add.dataset.id = task.id;
  add.onkeydown = e => {
    const text = add.value.trim();
    if (e.key !== 'Enter' || !text) return;
    task.subs.push({ id: newId(), text, done: false });
    refocusSub = task.id;
    tasksChanged();
  };
  card.append(add);
  return card;
}

// A task as a swipeable row (used on the Tasks page and in the dashboard widgets)
const taskRow = task => swipeRow(taskCard(task), taskSwipeCfg(task));

// ---------- Editing a task ----------
function editCard(task) {
  const li = el('li', 'item task editing');

  const text = el('input', 'inp');
  text.value = task.text;

  const when = el('div', 'row timerow');
  const date = makeDatePicker();
  date.set(task.date);
  const hh = el('input', 'inp');
  hh.min = '1'; hh.max = '12'; hh.placeholder = 'hh';
  const mm = el('input', 'inp');
  mm.min = '0'; mm.max = '59'; mm.placeholder = 'mm'; mm.dataset.pad = '1';
  const ap = el('select', 'inp ampm');
  ap.innerHTML = '<option>AM</option><option>PM</option>';
  const hhBox = enhanceNumber(hh);
  const mmBox = enhanceNumber(mm);
  const apBox = enhanceSelect(ap);
  timeToBoxes(task.time, hh, mm, ap);
  const cat = el('input', 'inp');
  cat.placeholder = tr('cat.ph');
  cat.value = task.category;
  const catBox = attachSuggest(cat, taskCategories);
  when.append(date.el, hhBox, el('span', 'muted', ':'), mmBox, apBox, catBox);

  // subtasks are edited on a copy and only applied when you press Save
  const draft = task.subs.map(s => ({ ...s }));
  const subBox = el('div');
  function drawSubs() {
    subBox.innerHTML = '';
    draft.forEach(s => {
      const r = el('div', 'row subrow');
      const i = el('input', 'inp');
      i.value = s.text;
      i.placeholder = tr('subPh');
      i.oninput = () => { s.text = i.value; };
      const x = el('button', 'x');
      x.innerHTML = icon('close');
      x.onclick = () => { draft.splice(draft.indexOf(s), 1); drawSubs(); };
      r.append(i, x);
      subBox.append(r);
    });
  }
  drawSubs();
  const addSub = el('button', 'linkbtn', tr('addSub'));
  addSub.onclick = () => {
    draft.push({ id: newId(), text: '', done: false });
    drawSubs();
    subBox.querySelector('.subrow:last-child input').focus();
  };

  const saveBtn = el('button', 'btn md', tr('save'));
  const cancelBtn = el('button', 'btn md ghost', tr('cancel'));
  saveBtn.onclick = () => {
    task.text = text.value.trim() || task.text;
    task.date = date.get();
    task.time = timeFromBoxes(hh, mm, ap);
    if (task.time && !task.date) task.date = iso(new Date());
    if (!task.date) task.time = '';
    task.category = cat.value.trim();
    task.subs = draft.filter(s => s.text.trim()).map(s => ({ ...s, text: s.text.trim() }));
    editingId = null;
    tasksChanged();
  };
  cancelBtn.onclick = () => { editingId = null; renderTasks(); };
  text.onkeydown = e => {
    if (e.key === 'Enter') saveBtn.onclick();
    if (e.key === 'Escape') cancelBtn.onclick();
  };

  const actions = el('div', 'edit-actions');
  actions.append(saveBtn, cancelBtn);
  li.append(text, when, subBox, addSub, actions);
  setTimeout(() => text.focus(), 0);
  return li;
}

// ---------- The page ----------
function renderTasks() {
  renderCategoryUI();

  const list = $('t-list');
  list.innerHTML = '';
  sortedTasks()
    .filter(task => taskFilter === 'All' || task.category === taskFilter)
    .forEach(task => list.append(task.id === editingId ? editCard(task) : taskRow(task)));

  if (refocusSub) {
    const box = list.querySelector('.subin[data-id="' + refocusSub + '"]');
    if (box) box.focus();
    refocusSub = null;
  }

  const open = data.tasks.filter(task => !task.done);
  const late = open.filter(task => taskDue(task) && taskDue(task) < new Date()).length;
  $('t-count').textContent = data.tasks.length
    ? tr('taskCount', { o: open.length, d: data.tasks.length - open.length }) + (late ? ', ' + tr('late', { n: late }) : '')
    : tr('tasks.empty');
}

function addTask() {
  const text = $('t-in').value.trim();
  if (!text) return;

  let date = createDate.get();
  let time = timeFromBoxes($('t-hh'), $('t-mm'), $('t-ap'));
  if (time && !date) date = iso(new Date());
  if (!date) time = '';

  data.tasks.push({
    id: newId(), text, done: false, date, time,
    category: $('t-cat').value.trim(), priority: 1, subs: [], created: Date.now(), doneAt: 0
  });

  ['t-in', 't-hh', 't-mm', 't-cat'].forEach(id => { $(id).value = ''; });
  createDate.clear();
  $('t-ap').value = 'AM';
  tasksChanged();
}

function initTasks() {
  createDate = makeDatePicker(true);
  $('t-date').append(createDate.el);
  $('t-add').onclick = addTask;
  ['t-in', 't-cat', 't-hh', 't-mm'].forEach(id => {
    $(id).onkeydown = e => { if (e.key === 'Enter') addTask(); };
  });
}
