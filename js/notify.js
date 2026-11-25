// ==========================================================
// notify.js - reminders for your tasks and events.
//
// On the phone this uses Capacitor's Local Notifications plugin, so the reminders arrive even when the app is closed.
// In a browser / the "npm start" preview it uses the browser's notifications (only while the app is open).
//
// What gets a reminder (next 7 days):
//   - a task with a deadline: N minutes before (Settings) and again when it is due
//   - an event with a time: the same
//   - an optional morning summary at 8:00
// Focus mode: while a focus session runs, reminders that are not critical (not a High-priority task) are held
// and arrive right after the session ends.
// ==========================================================

const FOCUS_NOTIF_ID = 1;      // the "focus session is over" notification
const NOTIF_DAYS = 7;          // how far ahead reminders are scheduled
let notifTimers = [];          // browser fallback timers
let notifSchedTimer = null;
let channelsReady = false;

// A number the phone can use as an id for each reminder
function hashId(text) {
  let h = 7;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) % 2147483000;
  return h + 10;
}

// 'granted' | 'denied' | 'prompt' | 'unsupported'
async function notifStatus() {
  const ln = nativePlugin('LocalNotifications');
  try {
    if (ln) {
      const p = await ln.checkPermissions();
      return p.display === 'granted' ? 'granted' : p.display === 'denied' ? 'denied' : 'prompt';
    }
    if ('Notification' in window) {
      return Notification.permission === 'granted' ? 'granted' : Notification.permission === 'denied' ? 'denied' : 'prompt';
    }
  } catch (e) { /* fall through */ }
  return 'unsupported';
}

async function notifAsk() {
  const ln = nativePlugin('LocalNotifications');
  try {
    if (ln) await ln.requestPermissions();
    else if ('Notification' in window) await Notification.requestPermission();
  } catch (e) { /* ignore */ }
  return notifStatus();
}

// Android groups notifications in "channels"
async function ensureChannels(ln) {
  if (channelsReady) return;
  // Zaal's own native code makes the channels, so the critical and focus ones can get through Do Not Disturb
  const z = typeof zn === 'function' ? zn() : null;
  if (z) {
    try { await z.createChannels(); channelsReady = true; return; } catch (e) { /* fall back below */ }
  }
  try {
    await ln.createChannel({ id: 'zaal-tasks', name: 'Task reminders', description: 'Reminders for tasks and events', importance: 4, visibility: 1, vibration: true });
    await ln.createChannel({ id: 'zaal-critical', name: 'Critical reminders', description: 'High-priority tasks', importance: 4, visibility: 1, vibration: true });
    await ln.createChannel({ id: 'zaal-focus', name: 'Focus timer', description: 'When a focus session or break ends', importance: 4, visibility: 1, vibration: true });
    channelsReady = true;
  } catch (e) { /* the plugin makes a default channel anyway */ }
}

// ---------- What should be sent ----------
const atTime = (dateIso, time) => {
  const [y, m, d] = dateIso.split('-').map(Number);
  const [hh, mm] = (time || '09:00').split(':').map(Number);
  return new Date(y, m - 1, d, hh, mm);
};

function notifItems() {
  const n = data.settings.notify;
  const now = Date.now();
  const horizon = now + NOTIF_DAYS * 86400000;
  const out = [];
  const add = (key, when, title, body, critical) => {
    const ms = when.getTime();
    if (ms > now + 3000 && ms < horizon) out.push({ key, at: ms, title, body, critical });
  };

  data.tasks.forEach(task => {
    if (task.done || !task.date) return;
    const due = atTime(task.date, task.time); // a task without a time is reminded at 9:00
    const critical = task.priority >= 2;
    if (n.before > 0 && task.time) add('t' + task.id + 'b', new Date(due.getTime() - n.before * 60000), task.text, tr('n.dueIn', { n: n.before }), critical);
    add('t' + task.id + 'd', due, task.text, tr('n.dueNow'), critical);
  });

  data.events.forEach(ev => {
    if (!ev.time) return;
    const start = atTime(ev.date, ev.time);
    if (n.before > 0) add('e' + ev.id + 'b', new Date(start.getTime() - n.before * 60000), ev.title, tr('n.eventIn', { n: n.before }), false);
    add('e' + ev.id + 'd', start, ev.title, tr('n.eventNow'), false);
  });

  if (n.summary) {
    for (let i = 0; i < 4; i++) {
      const day = new Date();
      day.setDate(day.getDate() + i);
      const key = iso(day);
      const tCount = data.tasks.filter(task => !task.done && task.date === key).length;
      const eCount = data.events.filter(ev => ev.date === key).length;
      if (tCount + eCount > 0) add('s' + key, atTime(key, '08:00'), tr('n.sumT'), tr('n.sumB', { t: tCount, e: eCount }), false);
    }
  }
  return out;
}

// ---------- Sending ----------
// Called after every change (js/core.js save). Waits a moment so a burst of changes only schedules once.
function scheduleNotifications() {
  clearTimeout(notifSchedTimer);
  notifSchedTimer = setTimeout(doSchedule, 600);
}

async function doSchedule() {
  if (!data.settings || !data.settings.notify) return;
  const ln = nativePlugin('LocalNotifications');
  let items = data.settings.notify.on ? notifItems() : [];

  // Focus mode: hold the non-critical ones until the session is over
  const until = typeof focusSilenceUntil === 'function' ? focusSilenceUntil() : 0;
  if (until) items.forEach(it => { if (!it.critical && it.at <= until) it.at = until + 2000; });
  items.sort((a, b) => a.at - b.at);
  items = items.slice(0, 60);

  if (ln) {
    try {
      const pending = await ln.getPending();
      const ours = pending.notifications.filter(x => x.id !== FOCUS_NOTIF_ID).map(x => ({ id: x.id }));
      if (ours.length) await ln.cancel({ notifications: ours });
      if (!items.length || (await notifStatus()) !== 'granted') return;
      await ensureChannels(ln);
      await ln.schedule({
        notifications: items.map(it => ({
          id: hashId(it.key), title: it.title, body: it.body, channelId: it.critical ? 'zaal-critical' : 'zaal-tasks',
          schedule: { at: new Date(it.at), allowWhileIdle: true }
        }))
      });
    } catch (e) { /* reminders are best effort */ }
    return;
  }

  // Browser / preview: timers that work while the app is open
  notifTimers.forEach(clearTimeout);
  notifTimers = [];
  if (!items.length || (await notifStatus()) !== 'granted') return;
  items.forEach(it => {
    const wait = it.at - Date.now();
    if (wait > 0 && wait < 2147483000) notifTimers.push(setTimeout(() => showNow(it.title, it.body), wait));
  });
}

// A notification right now (the test button, and the browser fallback)
async function showNow(title, body) {
  const ln = nativePlugin('LocalNotifications');
  try {
    if (ln) {
      await ensureChannels(ln);
      await ln.schedule({ notifications: [{ id: hashId('now' + Date.now()), title, body, channelId: 'zaal-tasks', schedule: { at: new Date(Date.now() + 1500) } }] });
    } else if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, { body });
    }
  } catch (e) { /* ignore */ }
}

// The "focus session is over" notification, scheduled for the moment the timer ends
async function scheduleFocusEnd(whenMs, title, body) {
  const ln = nativePlugin('LocalNotifications');
  if (!ln || !data.settings.notify.on) return;
  try {
    if ((await notifStatus()) !== 'granted') return;
    await ensureChannels(ln);
    await ln.cancel({ notifications: [{ id: FOCUS_NOTIF_ID }] });
    await ln.schedule({ notifications: [{ id: FOCUS_NOTIF_ID, title, body, channelId: 'zaal-focus', schedule: { at: new Date(whenMs), allowWhileIdle: true } }] });
  } catch (e) { /* ignore */ }
}

async function cancelFocusEnd() {
  const ln = nativePlugin('LocalNotifications');
  if (!ln) return;
  try { await ln.cancel({ notifications: [{ id: FOCUS_NOTIF_ID }] }); } catch (e) { /* ignore */ }
}

function startNotify() {
  scheduleNotifications();
  // The first time: ask for permission shortly after the app opens
  setTimeout(async () => {
    if (data.settings.notify.on && (await notifStatus()) === 'prompt') {
      await notifAsk();
      if (typeof refreshNotifyStatus === 'function') refreshNotifyStatus();
      scheduleNotifications();
    }
  }, 1500);
  // Keep the 7-day window moving
  setInterval(scheduleNotifications, 15 * 60 * 1000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) scheduleNotifications(); });
}
