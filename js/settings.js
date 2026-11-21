// ==========================================================
// settings.js - the Settings page: launch with Windows, calendar options.
// ==========================================================

async function initSettings() {
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
