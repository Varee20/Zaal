// ==========================================================
// app.js - starts everything. Loaded last.
// ==========================================================

function tick() {
  $('clock').textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// Live parts that don't need saved data
tick();
setInterval(tick, 30000);
startDashboard();

// Button / input handlers
initTasks();
initCalendar();
initSearch();
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
  startDrawer();
  startNotes();
  startWeather();
  pomoRender();
});
