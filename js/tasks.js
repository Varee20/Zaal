// ==========================================================
// tasks.js - the Tasks page: deadline, priority (arrows), category, subtasks, editing.
// Tasks with a deadline also show up in the calendar (see taskEvents / calEvents).
// ==========================================================

const PRIORITY_NAMES = ['Low', 'Medium', 'High'];
let createDate = null;     // the date picker in the "new task" row
let editingId = null;      // the task that is open for editing
let taskFilter = 'All';    // category filter
let refocusSub = null;     // keeps the cursor in the "add subtask" box after adding one

// Older saved tasks only had text + done, so fill in the new fields
function normalizeTask(t) {
  return Object.assign({ date: '', time: '', category: '', priority: 1, subs: [], created: 0 }, t);
}

// ---------- Deadlines ----------
function taskDue(t) {
  if (!t.date) return null;
  const [y, m, d] = t.date.split('-').map(Number);
  const [hh, mm] = (t.time || '23:59').split(':').map(Number);
  return new Date(y, m - 1, d, hh, mm);
}

function fmtDue(t) {
  const [y, m, d] = t.date.split('-').map(Number);
  const day = fmtCalDate(data.settings.calendar, new Date(y, m - 1, d, 12));
  return day + (t.time ? ', ' + fmtTime(t.time) : '');
}

// Every open task with a deadline becomes a calendar event (blue dot).
function taskEvents() {
  return data.tasks
    .filter(t => t.date && !t.done)
    .map(t => ({ id: 't_' + t.id, date: t.date, time: t.time, title: t.text, source: 'task', taskId: t.id }));
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

// ---------- Categories ----------
function taskCategories() {
  return [...new Set(data.tasks.map(t => t.category).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function renderCategoryUI() {
  const cats = taskCategories();
  if (taskFilter !== 'All' && !cats.includes(taskFilter)) taskFilter = 'All';

  const box = $('t-filter');
  box.innerHTML = '';
  if (cats.length) {
    ['All', ...cats].forEach(c => {
      const b = el('button', 'chip' + (c === taskFilter ? ' on' : ''), c);
      b.onclick = () => { taskFilter = c; renderTasks(); };
      box.append(b);
    });
  }
}

// ---------- One task ----------
function priorityBox(t) {
  const box = el('div', 'prio');
  const up = el('button', 'pbtn');
  const down = el('button', 'pbtn');
  up.innerHTML = icon('up');
  down.innerHTML = icon('down');
  up.title = 'Raise priority';
  down.title = 'Lower priority';
  up.disabled = t.priority >= 2;
  down.disabled = t.priority <= 0;
  up.onclick = () => { t.priority = Math.min(2, t.priority + 1); tasksChanged(); };
  down.onclick = () => { t.priority = Math.max(0, t.priority - 1); tasksChanged(); };
  box.append(up, el('span', 'plabel', PRIORITY_NAMES[t.priority]), down);
  return box;
}

function taskCard(t) {
  const li = el('li', 'item task p' + t.priority + (t.done ? ' done' : ''));

  // top line: checkbox, title, priority arrows, edit, delete
  const top = el('div', 'task-top');
  const check = el('input');
  check.type = 'checkbox';
  check.checked = t.done;
  check.onchange = () => { t.done = check.checked; tasksChanged(); };
  const edit = el('button', 'x edit');
  edit.innerHTML = icon('edit');
  edit.title = 'Edit';
  edit.onclick = () => { editingId = t.id; renderTasks(); };
  const del = el('button', 'x');
  del.innerHTML = icon('close');
  del.title = 'Delete';
  del.onclick = () => { data.tasks = data.tasks.filter(k => k.id !== t.id); tasksChanged(); };
  top.append(check, el('span', 't', t.text), priorityBox(t), edit, del);
  li.append(top);

  // info line: deadline, category, subtask progress
  const meta = el('div', 'task-meta');
  if (t.date) {
    const due = el('span', 'due', 'Due ' + fmtDue(t));
    const when = taskDue(t);
    if (!t.done && when && when < new Date()) due.classList.add('late');
    meta.append(due);
  }
  if (t.category) meta.append(el('span', 'gtag cat', t.category));
  if (t.subs.length) meta.append(el('span', '', t.subs.filter(s => s.done).length + '/' + t.subs.length + ' subtasks'));
  if (meta.children.length) li.append(meta);

  // subtasks
  if (t.subs.length) {
    const subs = el('ul', 'subs');
    t.subs.forEach(s => {
      const row = el('li', 'sub' + (s.done ? ' done' : ''));
      const c = el('input');
      c.type = 'checkbox';
      c.checked = s.done;
      c.onchange = () => { s.done = c.checked; tasksChanged(); };
      const x = el('button', 'x');
      x.innerHTML = icon('close');
      x.onclick = () => { t.subs = t.subs.filter(k => k.id !== s.id); tasksChanged(); };
      row.append(c, el('span', '', s.text), x);
      subs.append(row);
    });
    li.append(subs);
  }

  // add a subtask
  const add = el('input', 'inp subin');
  add.placeholder = '+ Add subtask';
  add.dataset.id = t.id;
  add.onkeydown = e => {
    const text = add.value.trim();
    if (e.key !== 'Enter' || !text) return;
    t.subs.push({ id: newId(), text, done: false });
    refocusSub = t.id;
    tasksChanged();
  };
  li.append(add);
  return li;
}

// ---------- Editing a task ----------
function editCard(t) {
  const li = el('li', 'item task editing');

  const text = el('input', 'inp');
  text.value = t.text;

  const when = el('div', 'row timerow');
  const date = makeDatePicker();
  date.set(t.date);
  const hh = el('input', 'inp');
  hh.min = '1'; hh.max = '12'; hh.placeholder = 'hh';
  const mm = el('input', 'inp');
  mm.min = '0'; mm.max = '59'; mm.placeholder = 'mm'; mm.dataset.pad = '1';
  const ap = el('select', 'inp ampm');
  ap.innerHTML = '<option>AM</option><option>PM</option>';
  const hhBox = enhanceNumber(hh);
  const mmBox = enhanceNumber(mm);
  const apBox = enhanceSelect(ap);
  timeToBoxes(t.time, hh, mm, ap);
  const cat = el('input', 'inp');
  cat.placeholder = 'Category';
  cat.value = t.category;
  const catBox = attachSuggest(cat, taskCategories);
  when.append(date.el, hhBox, el('span', 'muted', ':'), mmBox, apBox, catBox);

  // subtasks are edited on a copy and only applied when you press Save
  const draft = t.subs.map(s => ({ ...s }));
  const subBox = el('div');
  function drawSubs() {
    subBox.innerHTML = '';
    draft.forEach(s => {
      const r = el('div', 'row subrow');
      const i = el('input', 'inp');
      i.value = s.text;
      i.placeholder = 'Subtask';
      i.oninput = () => { s.text = i.value; };
      const x = el('button', 'x');
      x.innerHTML = icon('close');
      x.onclick = () => { draft.splice(draft.indexOf(s), 1); drawSubs(); };
      r.append(i, x);
      subBox.append(r);
    });
  }
  drawSubs();
  const addSub = el('button', 'linkbtn', '+ Add subtask');
  addSub.onclick = () => {
    draft.push({ id: newId(), text: '', done: false });
    drawSubs();
    subBox.querySelector('.subrow:last-child input').focus();
  };

  const saveBtn = el('button', 'btn md', 'Save');
  const cancelBtn = el('button', 'btn md ghost', 'Cancel');
  saveBtn.onclick = () => {
    t.text = text.value.trim() || t.text;
    t.date = date.get();
    t.time = timeFromBoxes(hh, mm, ap);
    if (t.time && !t.date) t.date = iso(new Date());
    if (!t.date) t.time = '';
    t.category = cat.value.trim();
    t.subs = draft.filter(s => s.text.trim()).map(s => ({ ...s, text: s.text.trim() }));
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
    .filter(t => taskFilter === 'All' || t.category === taskFilter)
    .forEach(t => list.append(t.id === editingId ? editCard(t) : taskCard(t)));

  if (refocusSub) {
    const box = list.querySelector('.subin[data-id="' + refocusSub + '"]');
    if (box) box.focus();
    refocusSub = null;
  }

  const open = data.tasks.filter(t => !t.done);
  const late = open.filter(t => taskDue(t) && taskDue(t) < new Date()).length;
  $('t-count').textContent = data.tasks.length
    ? open.length + ' open, ' + (data.tasks.length - open.length) + ' done' + (late ? ', ' + late + ' overdue' : '')
    : 'Nothing here yet. Add your first task.';
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
    category: $('t-cat').value.trim(), priority: 1, subs: [], created: Date.now()
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
