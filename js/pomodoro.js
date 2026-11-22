// ==========================================================
// pomodoro.js - the Focus timer: 25 minutes of focus, 5 minutes of break.
// ==========================================================

const POMO_SECONDS = { focus: 25 * 60, break: 5 * 60 };
let pomoMode = 'focus';
let pomoLeft = POMO_SECONDS.focus;
let pomoEnd = 0;       // the moment the running timer ends
let pomoTimer = null;

const pomoFmt = s => pad(Math.floor(s / 60)) + ':' + pad(s % 60);

function pomoRender() {
  $('pm-time').textContent = pomoFmt(pomoLeft);
  $('pm-bar').style.width = ((POMO_SECONDS[pomoMode] - pomoLeft) / POMO_SECONDS[pomoMode] * 100) + '%'; // how much of the session has passed
  $('pm-start').textContent = pomoTimer ? 'Pause' : 'Start';
  $('pm-focus').classList.toggle('on', pomoMode === 'focus');
  $('pm-break').classList.toggle('on', pomoMode === 'break');
  const done = data.pomo && data.pomo.date === iso(new Date()) ? data.pomo.count : 0;
  $('pm-count').textContent = 'Focus sessions today: ' + done;
}

function pomoStop() {
  clearInterval(pomoTimer);
  pomoTimer = null;
}

function pomoSet(mode) {
  pomoStop();
  pomoMode = mode;
  pomoLeft = POMO_SECONDS[mode];
  pomoRender();
}

// Three short beeps
function pomoBeep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [0, 0.35, 0.7].forEach(t => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = 880;
      osc.connect(gain);
      gain.connect(ctx.destination);
      const at = ctx.currentTime + t;
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(0.25, at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.28);
      osc.start(at);
      osc.stop(at + 0.3);
    });
  } catch (e) { /* no sound is fine */ }
}

function pomoDone() {
  const wasFocus = pomoMode === 'focus';
  if (wasFocus) {
    const today = iso(new Date());
    if (!data.pomo || data.pomo.date !== today) data.pomo = { date: today, count: 0 };
    data.pomo.count++;
    save();
  }
  pomoBeep();
  try { new Notification('Zaal', { body: wasFocus ? 'Focus session done. Take a break!' : 'Break is over. Back to focus!' }); } catch (e) { /* ignore */ }
  pomoSet(wasFocus ? 'break' : 'focus');
}

function initPomodoro() {
  $('pm-start').onclick = () => {
    if (pomoTimer) { pomoStop(); pomoRender(); return; } // pause
    pomoEnd = Date.now() + pomoLeft * 1000;
    pomoTimer = setInterval(() => {
      pomoLeft = Math.max(0, Math.round((pomoEnd - Date.now()) / 1000));
      pomoRender();
      if (pomoLeft <= 0) pomoDone();
    }, 500);
    pomoRender();
  };
  $('pm-reset').onclick = () => pomoSet(pomoMode);
  $('pm-focus').onclick = () => pomoSet('focus');
  $('pm-break').onclick = () => pomoSet('break');
  pomoRender();
}
