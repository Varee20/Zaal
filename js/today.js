// ==========================================================
// today.js - the top of the Dashboard (home screen): greeting, today's date and today's holidays.
// The rest of the home screen is made of widgets (js/widgets.js). Everything is redrawn on every save().
// ==========================================================

function greetingFor(hour) {
  if (hour < 5) return tr('greet.night');
  if (hour < 12) return tr('greet.morning');
  if (hour < 18) return tr('greet.afternoon');
  return tr('greet.evening');
}

function renderToday() {
  if (!$('greet')) return;
  const now = new Date();

  $('greet').textContent = greetingFor(now.getHours());
  // Today's date in your default calendar; the American date underneath when it is a different one
  const sys = data.settings.calendar;
  $('today-date').textContent = fmtCalDate(sys, now, true);
  $('today-alt').textContent = sys === 'american' ? '' : now.toLocaleDateString(langLocale('gregory'), { month: 'long', day: 'numeric', year: 'numeric' });

  // Holidays (follows the options in Settings -> Calendar)
  const hol = $('today-hol');
  hol.innerHTML = '';
  holidaysFor(new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12))
    .forEach(h => hol.append(el('span', 'gtag hbadge', h)));

  renderWidgets();
  if (typeof scheduleWidgetPush === 'function') scheduleWidgetPush(); // the home screen widgets follow along
}

function startToday() {
  renderToday();
  setInterval(() => { if (!document.hidden) renderToday(); }, 60 * 1000); // keeps the greeting, "today" and the widgets fresh
}
