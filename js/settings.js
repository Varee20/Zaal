// ==========================================================
// settings.js - the Settings page: launch with Windows, theme and mode, calendar options.
// ==========================================================

async function initSettings() {
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
    b.append(sw, el('span', '', id === 'custom' ? 'Custom' : THEMES[id].label));
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

  // Launch with Windows
  $('auto').checked = await window.pc.getAutostart();
  $('auto').onchange = () => window.pc.setAutostart($('auto').checked);
}
