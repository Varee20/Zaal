// ==========================================================
// settings.js - the Settings page: theme and mode, language, calendar options, dashboard widgets, notifications.
// ==========================================================

// Texts that are built in code (not in index.html) are redrawn here when the language changes
function refreshSettingsText() {
  renderWidgetRows();
  fillNotifyBefore();
  refreshNotifyStatus();
}

// ---------- Dashboard widgets: on/off and size ----------
function renderWidgetRows() {
  const box = $('wg-rows');
  if (!box || !data.settings.widgets) return;
  box.innerHTML = '';
  WIDGET_KEYS.forEach(key => {
    const cfg = data.settings.widgets[key];
    const row = el('div', 'wrow');

    const label = el('label', 'wlabel');
    const on = el('input');
    on.type = 'checkbox';
    on.checked = cfg.on;
    on.onchange = () => { cfg.on = on.checked; save(); renderWidgets(); };
    label.append(on, el('span', '', tr(WIDGET_TITLES[key])));

    const sizes = el('div', 'chips wsizes');
    ['s', 'm', 'l'].forEach(s => {
      const b = el('button', 'chip' + (cfg.size === s ? ' on' : ''), tr('size.' + s));
      b.onclick = () => { cfg.size = s; save(); renderWidgets(); renderWidgetRows(); };
      sizes.append(b);
    });

    row.append(label, sizes);
    box.append(row);
  });
}

// ---------- Notifications ----------
function fillNotifyBefore() {
  const sel = $('n-before');
  if (!sel) return;
  sel.innerHTML = '';
  [0, 5, 10, 30, 60].forEach(n => {
    const o = el('option', '', n === 0 ? tr('n.atTime') : tr('n.minBefore', { n }));
    o.value = String(n);
    sel.append(o);
  });
  sel.value = String(data.settings.notify.before);
}

async function refreshNotifyStatus() {
  if (!$('n-status')) return;
  const st = await notifStatus();
  $('n-status').textContent = tr('n.' + st);
  $('n-allow').style.display = st === 'prompt' ? '' : 'none';
}

function initNotifySettings() {
  const n = data.settings.notify;
  enhanceSelect($('n-before'));
  fillNotifyBefore();

  $('n-on').checked = n.on;
  $('n-on').onchange = async () => {
    n.on = $('n-on').checked;
    if (n.on) await notifAsk();
    save();
    refreshNotifyStatus();
  };
  $('n-before').onchange = () => { n.before = Number($('n-before').value); save(); };
  $('n-summary').checked = n.summary;
  $('n-summary').onchange = () => { n.summary = $('n-summary').checked; save(); };
  $('n-allow').onclick = async () => { await notifAsk(); refreshNotifyStatus(); scheduleNotifications(); };
  $('n-test').onclick = async () => {
    if ((await notifStatus()) !== 'granted') await notifAsk();
    showNow(tr('n.testT'), tr('n.testB'));
    refreshNotifyStatus();
  };
  refreshNotifyStatus();
}

// ---------- The page ----------
function initSettings() {
  // Customize: theme (presets + your own color) and mode (Dark / Light)
  if (!isHex(data.settings.customColor)) data.settings.customColor = DEFAULT_CUSTOM;
  const apply = () => applyTheme(data.settings.theme, data.settings.mode, data.settings.customColor);
  const showCustomize = () => {
    document.querySelectorAll('.theme-opt').forEach(b => b.classList.toggle('on', b.dataset.theme === data.settings.theme));
    document.querySelectorAll('#mode-chips .chip').forEach(b => b.classList.toggle('on', b.dataset.mode === data.settings.mode));
    $('custom-row').hidden = data.settings.theme !== 'custom';
    $('custom-color').value = data.settings.customColor;
    $('custom-hex').value = data.settings.customColor;
  };

  // One button per theme in the table (js/theme.js), plus Custom at the end
  const themeBox = $('theme-opts');
  Object.keys(THEMES).concat('custom').forEach(id => {
    const b = el('button', 'theme-opt');
    b.dataset.theme = id;
    const sw = el('i', id === 'custom' ? 'swatch custom' : 'swatch');
    if (id !== 'custom') sw.style.background = themeSwatch(id);
    const name = el('span', '', id === 'custom' ? tr('theme.custom') : THEMES[id].label);
    if (id === 'custom') name.dataset.i18n = 'theme.custom'; // follows the language
    b.append(sw, name);
    themeBox.append(b);
  });
  themeBox.onclick = e => {
    const b = e.target.closest('.theme-opt');
    if (!b) return;
    data.settings.theme = b.dataset.theme;
    save();
    apply();
    showCustomize();
  };
  document.querySelectorAll('#mode-chips .chip').forEach(b => {
    b.onclick = () => {
      data.settings.mode = b.dataset.mode;
      save();
      apply();
      showCustomize();
    };
  });

  // Custom color: the picker updates live while you drag, and saves when you let go
  $('custom-color').oninput = () => {
    data.settings.customColor = $('custom-color').value;
    $('custom-hex').value = data.settings.customColor;
    apply();
  };
  $('custom-color').onchange = () => save();
  $('custom-hex').onchange = () => {
    let v = $('custom-hex').value.trim().toLowerCase();
    if (v && v[0] !== '#') v = '#' + v;
    if (isHex(v)) {
      data.settings.customColor = v;
      save();
      apply();
    }
    showCustomize(); // puts the old value back if what you typed wasn't a color
  };

  apply();
  showCustomize();

  // Language
  const lang = $('lang-sel');
  Object.keys(LANGS).forEach(code => {
    const o = el('option', '', LANGS[code].native);
    o.value = code;
    lang.append(o);
  });
  enhanceSelect(lang);
  lang.value = LANG;
  lang.onchange = () => {
    data.settings.lang = lang.value;
    setLanguage(lang.value);
    save();
    onLanguageChanged(); // app.js: redraws everything in the new language
  };

  // Default calendar (American / Persian / Islamic)
  document.querySelectorAll('input[name="calsys"]').forEach(r => {
    r.checked = r.value === data.settings.calendar;
    r.onchange = () => {
      if (!r.checked) return;
      data.settings.calendar = r.value;
      save();
      renderCal();
      refreshDatePickers();
      renderTasks();
    };
  });

  // Holidays to show (Persian / Islamic / American)
  ['persian', 'islamic', 'us'].forEach(k => {
    const box = $('cal-' + k);
    box.checked = !!data.settings[k];
    box.onchange = () => { data.settings[k] = box.checked; save(); renderCal(); };
  });

  renderWidgetRows();
  initNotifySettings();
}
