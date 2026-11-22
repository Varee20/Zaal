// ==========================================================
// theme.js - colour theme (Bronze / Silver / Gold) and dark / light mode.
// Loaded in <head>, so the right colours are on before the page draws.
// ==========================================================

const THEMES = ['bronze', 'silver', 'gold'];
const MODES = ['dark', 'light'];

// Sets the colours. The CSS does the rest (see :root[data-theme] and :root[data-mode] in style.css).
function applyTheme(theme, mode) {
  if (!THEMES.includes(theme)) theme = 'gold';
  if (!MODES.includes(mode)) mode = 'dark';
  document.documentElement.dataset.theme = theme;
  document.documentElement.dataset.mode = mode;
  // Remembered here too, so the next start shows the right colours instantly (no flash while data.json loads)
  try {
    localStorage.setItem('zaal-theme', theme);
    localStorage.setItem('zaal-mode', mode);
  } catch (e) { /* not important */ }
}

(function () {
  let theme, mode;
  try {
    theme = localStorage.getItem('zaal-theme');
    mode = localStorage.getItem('zaal-mode');
  } catch (e) { /* not important */ }
  applyTheme(theme, mode);
})();
