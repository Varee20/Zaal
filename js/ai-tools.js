// ==========================================================
// ai-tools.js - what the AI assistant is allowed to do.
// The assistant never touches your save file. It can only ask for the actions below;
// Zaal checks every request, shows it to you, and only runs it after you press Apply.
// ==========================================================

const toolDef = (name, description, properties, required) => ({
  type: 'function',
  function: { name, description, parameters: { type: 'object', properties, required: required || [] } }
});

const TASK_NUMBER = { type: 'integer', description: 'Task number from the list (the number after T)' };

const AI_TOOLS = [
  toolDef('add_task', 'Add a new task. Deadline, category, priority and subtasks are optional.', {
    text: { type: 'string', description: 'Task title' },
    date: { type: 'string', description: 'Deadline date as YYYY-MM-DD' },
    time: { type: 'string', description: 'Deadline time as 24-hour HH:MM' },
    category: { type: 'string' },
    priority: { type: 'string', enum: ['low', 'medium', 'high'] },
    subtasks: { type: 'array', items: { type: 'string' } }
  }, ['text']),
  toolDef('update_task', 'Change an existing task. Only include what changes. Use date "none" to remove the deadline.', {
    id: TASK_NUMBER,
    text: { type: 'string' },
    date: { type: 'string', description: 'YYYY-MM-DD, or "none"' },
    time: { type: 'string', description: '24-hour HH:MM' },
    category: { type: 'string' },
    priority: { type: 'string', enum: ['low', 'medium', 'high'] }
  }, ['id']),
  toolDef('complete_task', 'Mark a task as done (or not done).', { id: TASK_NUMBER, done: { type: 'boolean' } }, ['id']),
  toolDef('delete_task', 'Delete a task.', { id: TASK_NUMBER }, ['id']),
  toolDef('add_subtask', 'Add a subtask to a task.', { id: TASK_NUMBER, text: { type: 'string' } }, ['id', 'text']),
  toolDef('add_event', 'Add a calendar event.', {
    title: { type: 'string' },
    date: { type: 'string', description: 'YYYY-MM-DD' },
    time: { type: 'string', description: '24-hour HH:MM (leave out for an all-day event)' }
  }, ['title', 'date']),
  toolDef('delete_event', 'Delete a calendar event.', { id: { type: 'integer', description: 'Event number from the list (the number after E)' } }, ['id'])
];

// ---------- What the assistant gets to see ----------
function aiContext() {
  const now = new Date();
  const from = iso(addDays(now, -3)), to = iso(addDays(now, 45));
  const tasks = sortedTasks().slice(0, 60);
  const events = data.events
    .filter(e => e.date >= from && e.date <= to)
    .sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')))
    .slice(0, 40);
  return { now, today: iso(now), tasks, events };
}

function describeTask(t, n) {
  const bits = ['T' + n + ': "' + t.text + '"', t.done ? '[done]' : '[open]'];
  if (t.date) bits.push('due ' + t.date + (t.time ? ' ' + t.time : ''));
  if (t.category) bits.push('category ' + t.category);
  bits.push('priority ' + PRIORITY_NAMES[t.priority].toLowerCase());
  if (t.subs.length) bits.push('subtasks: ' + t.subs.map(s => (s.done ? '[x] ' : '[ ] ') + s.text).join('; '));
  return bits.join(', ');
}

function buildSystemPrompt(ctx) {
  const days = [];
  for (let i = 0; i < 14; i++) {
    const d = addDays(ctx.now, i);
    days.push(d.toLocaleDateString('en-US', { weekday: 'long' }) + ' ' + iso(d) + (i === 0 ? ' (today)' : ''));
  }
  return [
    'You are the assistant built into Zaal, a desktop planner. You help the user manage their tasks and calendar events.',
    'To add, change, complete or delete anything you MUST call a tool. Never say something was changed unless you called a tool for it.',
    'For questions about tasks or events, answer from the lists below in one or two short sentences.',
    'Dates must be YYYY-MM-DD and times 24-hour HH:MM. Refer to existing tasks and events by their number.',
    'If a request is unclear, ask one short question instead of guessing.',
    '',
    'Time now: ' + pad(ctx.now.getHours()) + ':' + pad(ctx.now.getMinutes()) + '. The next 14 days: ' + days.join('; ') + '.',
    '',
    'Tasks:',
    ctx.tasks.length ? ctx.tasks.map((t, i) => describeTask(t, i + 1)).join('\n') : '(none)',
    '',
    'Upcoming events:',
    ctx.events.length ? ctx.events.map((e, i) => 'E' + (i + 1) + ': "' + e.title + '" on ' + e.date + (e.time ? ' ' + e.time : '')).join('\n') : '(none)'
  ].join('\n');
}

// ---------- Checking what the assistant asks for ----------
const clean = v => (v === undefined || v === null ? '' : String(v).trim());
const PRIORITY_WORDS = { low: 0, medium: 1, normal: 1, high: 2 };

function validDate(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}

function cleanTime(s) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(clean(s));
  if (!m) return null;
  const h = Number(m[1]), min = Number(m[2]);
  return h > 23 || min > 59 ? null : pad(h) + ':' + pad(min);
}

// "Friday, 6 Aban, 3:00 PM" (in your default calendar)
function whenText(date, time) {
  const [y, m, d] = date.split('-').map(Number);
  return fmtCalDate(data.settings.calendar, new Date(y, m - 1, d, 12)) + (time ? ', ' + fmtTime(time) : '');
}

// Turns one request from the assistant into { label, run } (or { error })
function planOne(name, a, ctx) {
  const taskAt = () => ctx.tasks[Number(a.id) - 1];
  const noTask = () => ({ error: 'there is no task T' + clean(a.id) });

  switch (name) {
    case 'add_task': {
      const text = clean(a.text);
      if (!text) return { error: 'the task has no title' };
      let date = clean(a.date), time = '';
      if (date && !validDate(date)) return { error: 'I could not understand the date "' + date + '"' };
      if (clean(a.time)) {
        time = cleanTime(a.time);
        if (time === null) return { error: 'I could not understand the time "' + clean(a.time) + '"' };
      }
      if (time && !date) date = ctx.today;
      if (!date) time = '';
      const priority = clean(a.priority) ? PRIORITY_WORDS[clean(a.priority).toLowerCase()] : 1;
      if (priority === undefined) return { error: 'unknown priority "' + clean(a.priority) + '"' };
      const category = clean(a.category);
      const subs = (Array.isArray(a.subtasks) ? a.subtasks : []).map(clean).filter(Boolean);

      let label = 'Add task "' + text + '"';
      if (date) label += ', due ' + whenText(date, time);
      if (category) label += ', category ' + category;
      if (priority !== 1) label += ', ' + PRIORITY_NAMES[priority].toLowerCase() + ' priority';
      if (subs.length) label += ', with ' + subs.length + ' subtask' + (subs.length > 1 ? 's' : '');
      return {
        label,
        run: () => data.tasks.push({
          id: newId(), text, done: false, date, time, category, priority, created: Date.now(),
          subs: subs.map(s => ({ id: newId(), text: s, done: false }))
        })
      };
    }

    case 'update_task': {
      const t = taskAt();
      if (!t) return noTask();
      const changes = [], steps = [];
      if (clean(a.text)) { const v = clean(a.text); changes.push('title "' + v + '"'); steps.push(() => { t.text = v; }); }
      if (clean(a.date)) {
        const d = clean(a.date);
        if (d.toLowerCase() === 'none') { changes.push('no deadline'); steps.push(() => { t.date = ''; t.time = ''; }); }
        else if (!validDate(d)) return { error: 'I could not understand the date "' + d + '"' };
        else { changes.push('due ' + whenText(d, '')); steps.push(() => { t.date = d; }); }
      }
      if (clean(a.time)) {
        const tm = cleanTime(a.time);
        if (tm === null) return { error: 'I could not understand the time "' + clean(a.time) + '"' };
        changes.push('time ' + fmtTime(tm));
        steps.push(() => { t.time = tm; if (!t.date) t.date = ctx.today; });
      }
      if (clean(a.category)) { const v = clean(a.category); changes.push('category ' + v); steps.push(() => { t.category = v; }); }
      if (clean(a.priority)) {
        const p = PRIORITY_WORDS[clean(a.priority).toLowerCase()];
        if (p === undefined) return { error: 'unknown priority "' + clean(a.priority) + '"' };
        changes.push(PRIORITY_NAMES[p].toLowerCase() + ' priority');
        steps.push(() => { t.priority = p; });
      }
      if (!changes.length) return { error: 'nothing to change on T' + clean(a.id) };
      return { label: 'Change "' + t.text + '": ' + changes.join(', '), run: () => steps.forEach(f => f()) };
    }

    case 'complete_task': {
      const t = taskAt();
      if (!t) return noTask();
      const done = !(a.done === false || a.done === 'false');
      return { label: (done ? 'Mark "' + t.text + '" as done' : 'Reopen "' + t.text + '"'), run: () => { t.done = done; } };
    }

    case 'delete_task': {
      const t = taskAt();
      if (!t) return noTask();
      return { label: 'Delete task "' + t.text + '"', danger: true, run: () => { data.tasks = data.tasks.filter(k => k !== t); } };
    }

    case 'add_subtask': {
      const t = taskAt();
      if (!t) return noTask();
      const text = clean(a.text);
      if (!text) return { error: 'the subtask has no title' };
      return { label: 'Add subtask "' + text + '" to "' + t.text + '"', run: () => { t.subs.push({ id: newId(), text, done: false }); } };
    }

    case 'add_event': {
      const title = clean(a.title);
      const date = clean(a.date);
      if (!title) return { error: 'the event has no title' };
      if (!validDate(date)) return { error: 'I could not understand the date "' + date + '"' };
      let time = '';
      if (clean(a.time)) {
        time = cleanTime(a.time);
        if (time === null) return { error: 'I could not understand the time "' + clean(a.time) + '"' };
      }
      return {
        label: 'Add event "' + title + '" on ' + whenText(date, time),
        run: () => data.events.push({ id: newId(), date, time, title })
      };
    }

    case 'delete_event': {
      const ev = ctx.events[Number(a.id) - 1];
      if (!ev) return { error: 'there is no event E' + clean(a.id) };
      return { label: 'Delete event "' + ev.title + '" (' + ev.date + ')', danger: true, run: () => { data.events = data.events.filter(k => k !== ev); } };
    }

    default:
      return { error: 'I do not know how to "' + name + '"' };
  }
}

function planActions(calls, ctx) {
  const actions = [], skipped = [];
  calls.forEach(c => {
    const name = c.function ? c.function.name : c.name;
    let args = c.function ? c.function.arguments : c.arguments;
    if (typeof args === 'string') { try { args = JSON.parse(args); } catch (e) { args = {}; } }
    const r = planOne(name, args || {}, ctx);
    if (r.error) skipped.push('Skipped: ' + r.error + '.'); else actions.push(r);
  });
  return { actions, skipped };
}

// ---------- Applying and undoing ----------
const snapshotData = () => JSON.parse(JSON.stringify({ tasks: data.tasks, events: data.events }));

function restoreData(snap) {
  data.tasks = snap.tasks;
  data.events = snap.events;
  tasksChanged(); // saves and redraws the tasks and the calendar
}

function applyActions(actions) {
  const snap = snapshotData();
  actions.forEach(a => a.run());
  tasksChanged();
  return snap;
}

// ---------- Cleaning up what the model says ----------
const stripThink = text => String(text || '').replace(/<think>[\s\S]*?<\/think>/g, '').trim();

// Some small models write the action as plain text instead of a proper tool call
function parseInlineToolCall(text) {
  const start = text.indexOf('{'), end = text.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    const o = JSON.parse(text.slice(start, end + 1));
    if (o && o.name && (o.arguments || o.parameters)) return { function: { name: o.name, arguments: o.arguments || o.parameters } };
  } catch (e) { /* not a tool call */ }
  return null;
}
