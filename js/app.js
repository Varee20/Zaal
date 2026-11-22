// ==========================================================
// app.js - starts everything. Loaded last.
// ==========================================================

function tick() {
  const now = new Date();
  $('clock').textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  $('cdate').textContent = now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

// Live parts that don't need saved data
tick();
setInterval(tick, 10000);
startDashboard();
initUI(); // themed dropdowns, number boxes and icons (js/ui.js)

// Button / input handlers
initTasks();
initCalendar();
initSearch();
initAI();
initDrawer();
initQuick();
initPomodoro();
initNotes();
initWeather();

// Load saved data, then draw the pages that use it
window.pc.loadData().then(d => {
  data = Object.assign({ tasks: [], events: [], gcal: [], note: '', pomo: { date: '', count: 0 } }, d);
  data.settings = Object.assign({}, DEFAULT_SETTINGS, d.settings);
  data.tasks = data.tasks.map(normalizeTask);
  refreshDatePickers();
  renderTasks();
  renderCal();
  initSettings();
  startAI();
  startDrawer();
  startNotes();
  startWeather();
  pomoRender();
});
