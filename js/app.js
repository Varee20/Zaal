// ==========================================================
// app.js - starts everything. Loaded last.
// ==========================================================

// Language first, so the first thing you see is already in the right language and direction
applyI18n();

// Live parts that don't need saved data
startDashboard();
initUI(); // themed dropdowns, number boxes and icons (js/ui.js)

// Button / input handlers
initTasks();
initCalendar();
initSearch();
initNavDrawer();
initFocus();
initNative();
initScreenTime();
initNotes();
initWeather();

// Called after you pick another language in Settings: redraw everything that was built in code
function onLanguageChanged() {
  applyI18n();
  navArrow();
  renderTasks();
  renderCal();
  refreshDatePickers();
  renderToday();
  updateStats();
  drawWeather();
  focusRender();
  refreshDndRow();
  renderScreenTime();
  refreshSettingsText();
  scheduleNotifications(); // the reminder texts are in the new language too
}

// Load saved data, then draw the pages that use it
window.pc.loadData().then(d => {
  data = Object.assign({
    tasks: [], events: [], gcal: [], note: '', pomo: { date: '', count: 0 },
    activity: {}, timer: { mode: 'focus', running: false, end: 0, left: 0 }, screen: { days: {} }
  }, d);

  // settings: new options get their defaults, old saved ones are kept
  data.settings = Object.assign({}, DEFAULT_SETTINGS, d.settings);
  ['notify', 'focus'].forEach(k => { data.settings[k] = Object.assign({}, DEFAULT_SETTINGS[k], data.settings[k]); });
  const widgets = {};
  Object.keys(DEFAULT_SETTINGS.widgets).forEach(k => { widgets[k] = Object.assign({}, DEFAULT_SETTINGS.widgets[k], (data.settings.widgets || {})[k]); });
  data.settings.widgets = widgets;
  data.timer = Object.assign({ mode: 'focus', running: false, end: 0, left: 0 }, data.timer);

  if (data.settings.lang && data.settings.lang !== LANG && LANGS[data.settings.lang]) setLanguage(data.settings.lang);

  data.tasks = data.tasks.map(normalizeTask);
  refreshDatePickers();
  renderTasks();
  renderCal();
  initSettings();
  startToday();
  startNotes();
  startWeather();
  startFocus();
  startScreenTime();
  startNotify();
  navArrow();
});
