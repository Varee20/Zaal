// ==========================================================
// datepicker.js - a date picker made of Day / Month / Year dropdowns.
// The months follow your default calendar (Settings -> Calendar), so you pick "Aban" or "May"
// instead of typing a number. The date itself is stored as a normal (American) date.
// ==========================================================

const datePickers = []; // the pickers that stay on the page (so they can follow a calendar change)

function makeDatePicker(persistent) {
  const day = el('select', 'inp dsel dday');
  const month = el('select', 'inp dsel dmonth');
  const year = el('select', 'inp dsel dyear');
  const clear = el('button', 'x');
  clear.innerHTML = icon('close');
  clear.title = t('date.clear');
  const box = el('div', 'datepick');
  box.append(enhanceSelect(day), enhanceSelect(month), enhanceSelect(year), clear); // themed dropdowns (js/ui.js)

  let value = ''; // "YYYY-MM-DD" (American date) or ""

  function fill(select, placeholder, items) {
    select.innerHTML = '';
    const first = el('option', '', placeholder);
    first.value = '';
    select.append(first);
    items.forEach(it => {
      const o = el('option', '', it.t);
      o.value = String(it.v);
      select.append(o);
    });
  }

  // Show the stored date in the chosen calendar
  function draw() {
    const sys = data.settings.calendar;
    const today = calParts(sys, new Date());
    let p = null;
    if (value) {
      const [y, m, d] = value.split('-').map(Number);
      p = calParts(sys, new Date(y, m - 1, d, 12));
    }

    const years = [];
    const from = Math.min(today.y - 1, p ? p.y : today.y);
    const to = Math.max(today.y + 10, p ? p.y : today.y);
    for (let y = from; y <= to; y++) years.push({ v: y, t: String(y) });
    fill(year, t('date.year'), years);
    fill(month, t('date.month'), monthNames(sys).map((name, i) => ({ v: i + 1, t: name })));

    const length = p ? monthLength(sys, fromCalParts(sys, p.y, p.m, 1)) : 31;
    fill(day, t('date.day'), Array.from({ length }, (_, i) => ({ v: i + 1, t: String(i + 1) })));

    year.value = p ? String(p.y) : '';
    month.value = p ? String(p.m) : '';
    day.value = p ? String(p.d) : '';
    clear.title = t('date.clear');
    clear.style.visibility = value ? 'visible' : 'hidden';
  }

  // Picking any part fills the blank parts from today, then fixes the day if the month is shorter
  function onPick() {
    const sys = data.settings.calendar;
    const today = calParts(sys, new Date());
    const y = Number(year.value) || today.y;
    const m = Number(month.value) || today.m;
    const first = fromCalParts(sys, y, m, 1);
    if (!first) return;
    const d = Math.min(Number(day.value) || today.d, monthLength(sys, first));
    value = iso(addDays(first, d - 1));
    draw();
  }

  [day, month, year].forEach(s => { s.onchange = onPick; });
  clear.onclick = () => { value = ''; draw(); };

  const api = {
    el: box,
    get: () => value,
    set: v => { value = v || ''; draw(); },
    clear: () => { value = ''; draw(); },
    draw
  };
  if (persistent) datePickers.push(api);
  draw();
  return api;
}

function refreshDatePickers() {
  datePickers.forEach(p => p.draw());
}
