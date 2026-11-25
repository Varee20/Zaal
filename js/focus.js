// ==========================================================
// focus.js - the Focus tab: one tap starts a work session (pomodoro) and turns on focus mode.
//
// Focus mode = while a focus session runs, reminders that are not critical are held until it ends
// (see js/notify.js). High-priority tasks still get through. Breaks do not silence anything.
// The timer survives closing the app: it remembers when the session should end.
// The session count, minutes and the streak feed the dashboard widgets.
// ==========================================================

let focusTimer = null;

const fset = () => data.settings.focus;
const modeSecs = mode => (mode === 'focus' ? fset().focus : fset().break) * 60;
const fmtClock = s => pad(Math.floor(s / 60)) + ':' + pad(s % 60);

function timerLeft() {
  const tm = data.timer;
  return tm.running ? Math.max(0, Math.round((tm.end - Date.now()) / 1000)) : tm.left;
}

// Used by js/notify.js: until when should non-critical reminders be held? (0 = not at all)
function focusSilenceUntil() {
  const tm = data.timer;
  return tm && tm.running && tm.mode === 'focus' && fset().silence ? tm.end : 0;
}

// ---------- Sound ----------
function focusBeep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [0, 0.35, 0.7].forEach(offset => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = 880;
      osc.connect(gain);
      gain.connect(ctx.destination);
      const at = ctx.currentTime + offset;
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(0.25, at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.28);
      osc.start(at);
      osc.stop(at + 0.3);
    });
  } catch (e) { /* no sound is fine */ }
  try { if (navigator.vibrate) navigator.vibrate([200, 100, 200]); } catch (e) { /* ignore */ }
}

// ---------- Timer controls ----------
function ensureFocusTick() {
  if (data.timer.running && !focusTimer) focusTimer = setInterval(focusTick, 500);
  if (!data.timer.running && focusTimer) { clearInterval(focusTimer); focusTimer = null; }
}

function focusTick() {
  if (timerLeft() <= 0) focusFinish(false);
  else focusRender();
}

// Something changed (start, pause, reset): save, redraw, and fix the "session over" notification
function focusChanged() {
  const tm = data.timer;
  save(); // this also re-schedules the reminders, so focus mode takes effect right away
  if (tm.running) {
    const focus = tm.mode === 'focus';
    scheduleFocusEnd(tm.end, tr(focus ? 'focus.doneT' : 'focus.breakT'), tr(focus ? 'focus.doneB' : 'focus.breakB'));
  } else {
    cancelFocusEnd();
  }
  // the phone's own Do Not Disturb, while a focus session runs (js/native.js; only inside the phone app)
  if (tm.running && tm.mode === 'focus' && fset().silence) dndBegin(tm.end);
  else dndEnd();
  ensureFocusTick();
  focusRender();
}

function focusStart() {
  const tm = data.timer;
  if (!tm.left || tm.left > modeSecs(tm.mode)) tm.left = modeSecs(tm.mode);
  tm.running = true;
  tm.end = Date.now() + tm.left * 1000;
  focusChanged();
}

function focusPause() {
  const tm = data.timer;
  tm.left = timerLeft();
  tm.running = false;
  tm.end = 0;
  focusChanged();
}

function focusReset(mode) {
  const tm = data.timer;
  if (mode) tm.mode = mode;
  tm.running = false;
  tm.end = 0;
  tm.left = modeSecs(tm.mode);
  focusChanged();
}

// The session (or break) reached zero. "quiet" = it ended while the app was closed, so no beep.
function focusFinish(quiet) {
  const tm = data.timer;
  const wasFocus = tm.mode === 'focus';
  if (wasFocus) logActivity('focus', 1, null, fset().focus);
  tm.mode = wasFocus ? 'break' : 'focus';
  tm.running = false;
  tm.end = 0;
  tm.left = modeSecs(tm.mode);
  if (!quiet) {
    focusBeep();
    // on the phone the notification was scheduled when the timer started, so only the browser needs this one
    if (!nativePlugin('LocalNotifications')) showNow(tr(wasFocus ? 'focus.doneT' : 'focus.breakT'), tr(wasFocus ? 'focus.doneB' : 'focus.breakB'));
  }
  save();
  dndEnd();
  ensureFocusTick();
  focusRender();
}

// ---------- Drawing ----------
function focusRender() {
  if (!$('f-time')) return;
  const tm = data.timer;
  const total = modeSecs(tm.mode);
  const left = Math.min(timerLeft(), total);
  const focusing = tm.running && tm.mode === 'focus';

  $('f-time').textContent = fmtClock(left);
  const bar = $('f-bar');
  bar.style.strokeDasharray = RING_LENGTH;
  bar.style.strokeDashoffset = RING_LENGTH * (1 - (total ? (total - left) / total : 0));

  $('f-chip-focus').classList.toggle('on', tm.mode === 'focus');
  $('f-chip-break').classList.toggle('on', tm.mode === 'break');
  $('focus').classList.toggle('focusing', focusing && fset().silence);

  // What the big button does next
  const paused = !tm.running && left < total;
  $('f-start').textContent = tm.running ? tr('focus.pause') : paused ? tr('focus.resume') : tr(tm.mode === 'focus' ? 'focus.start' : 'focus.startBreak');
  $('f-state').textContent = tm.running
    ? (tm.mode === 'focus' ? tr('focus.on') : tr('focus.break'))
    : paused ? tr('focus.paused') : tr('focus.off');

  $('f-silence').checked = !!fset().silence;
  $('f-fv').textContent = fset().focus;
  $('f-bv').textContent = fset().break;

  const day = (data.activity && data.activity[iso(new Date())]) || {};
  $('f-sessions').textContent = day.focus || 0;
  $('f-minutes').textContent = day.focusMin || 0;
  $('f-streak').textContent = streakDays();
}

function initFocus() {
  $('f-start').onclick = () => (data.timer.running ? focusPause() : focusStart());
  $('f-reset').onclick = () => focusReset();
  $('f-chip-focus').onclick = () => focusReset('focus');
  $('f-chip-break').onclick = () => focusReset('break');
  $('f-silence').onchange = () => { fset().silence = $('f-silence').checked; focusChanged(); };

  // +/- for the lengths. Changing a length restarts an idle timer of that kind so the clock shows the new length.
  const stepper = (key, mode, step, min, max, minus, plus) => {
    const change = delta => {
      fset()[key] = Math.min(max, Math.max(min, fset()[key] + delta));
      if (!data.timer.running && data.timer.mode === mode) data.timer.left = modeSecs(mode);
      focusChanged();
    };
    $(minus).onclick = () => change(-step);
    $(plus).onclick = () => change(step);
  };
  stepper('focus', 'focus', 5, 5, 90, 'f-fm', 'f-fp');
  stepper('break', 'break', 1, 1, 30, 'f-bm', 'f-bp');

  // Come back to the app: catch up if a session ended while it was in the background
  document.addEventListener('visibilitychange', () => { if (!document.hidden && data.timer) focusTick(); });
}

// After the saved data is loaded
function startFocus() {
  const tm = data.timer;
  if (!tm.left) tm.left = modeSecs(tm.mode);
  if (tm.running && tm.end <= Date.now()) focusFinish(true); // it ended while the app was closed
  else if (tm.running && tm.mode === 'focus' && fset().silence) dndBegin(tm.end);
  ensureFocusTick();
  focusRender();
}
