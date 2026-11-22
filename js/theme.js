// ==========================================================
// theme.js - colour themes (Bronze, Silver, Gold, ... and Custom) and dark / light mode.
// Loaded in <head>, so the right colours are on before the page draws.
//
// To add a theme: add one entry to THEMES below. Give it an accent colour for dark mode and
// one for light mode (darker, so text stays readable on white). Every other colour of the
// theme (glow, ring colours, ...) is worked out from the accent. If you want to hand-pick
// one of those, put it in "vars" (see Gold and Obsidian).
// ==========================================================

const MODES = ['dark', 'light', 'system']; // "system" follows the Windows / Linux dark or light setting
const DEFAULT_CUSTOM = '#7c5cff';

const THEMES = {
  bronze: { label: 'Bronze', dark: { accent: '#b0803c' }, light: { accent: '#8a5a22' } },
  silver: {
    label: 'Silver',
    dark: { accent: '#c3c8d2', vars: { '--bronze': '#8d97a8', '--champagne': '#dde2ea', '--silver': '#9aa1ad', '--bg-glow': '#1b1f27' } },
    light: { accent: '#5d6675', vars: { '--bronze': '#78818f', '--champagne': '#a3abb8', '--silver': '#8a909a' } }
  },
  gold: {
    label: 'Gold',
    dark: { accent: '#d4af37', vars: { '--bronze': '#b8935a', '--champagne': '#e3d3a1', '--silver': '#a8a59d', '--bg-glow': '#26231a', '--copper': '#d9733a' } },
    light: { accent: '#a8841a', vars: { '--bronze': '#8a6a35', '--champagne': '#c9a94a', '--silver': '#7a766c', '--copper': '#d9733a' } }
  },
  titanium: { label: 'Titanium', dark: { accent: '#8aa0b8' }, light: { accent: '#4a6178' } },
  copper: { label: 'Copper', dark: { accent: '#e0603a' }, light: { accent: '#b8431f' } },
  rosegold: { label: 'Rose Gold', dark: { accent: '#dc9aa3' }, light: { accent: '#a4505c' } },
  cobalt: { label: 'Cobalt', dark: { accent: '#4a85e8' }, light: { accent: '#1f55b8' } },
  verdigris: { label: 'Verdigris', dark: { accent: '#4cb8a5' }, light: { accent: '#1f7a6b' } },
  platinum: { label: 'Platinum', dark: { accent: '#e8e6e1' }, light: { accent: '#4d4b46' } },
  obsidian: {
    label: 'Obsidian',
    dark: { accent: '#9b7bff', vars: { '--bg': '#060608', '--panel': '#0e0d12', '--panel-2': '#0a090d', '--line': '#25232e', '--track': '#25232e', '--bg-glow': '#1c1530' } },
    light: { accent: '#5b3fd0' }
  }
};

// ---------- Colour maths ----------
const isHex = v => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v);

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  let h = 0, s = 0;
  if (d) {
    s = d / (1 - Math.abs(2 * l - 1));
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h = (h * 60 + 360) % 360;
  }
  return [h, s * 100, l * 100];
}

function hslToHex(h, s, l) {
  h = ((h % 360) + 360) % 360;
  s = Math.min(Math.max(s, 0), 100) / 100;
  l = Math.min(Math.max(l, 0), 100) / 100;
  const a = s * Math.min(l, 1 - l);
  const f = n => {
    const k = (n + h / 30) % 12;
    return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  const hex = x => Math.round(x * 255).toString(16).padStart(2, '0');
  return '#' + hex(f(0)) + hex(f(8)) + hex(f(4));
}

// A custom colour can be too dark for dark mode or too bright for light mode, so nudge its lightness
function fitAccent(hex, isLight) {
  const [h, s, l] = rgbToHsl(...hexToRgb(hex));
  return hslToHex(h, s, isLight ? Math.min(Math.max(l, 22), 38) : Math.min(Math.max(l, 52), 74));
}

// Everything the CSS needs, worked out from one accent colour
function deriveVars(accent, isLight) {
  const [r, g, b] = hexToRgb(accent);
  const [h, s, l] = rgbToHsl(r, g, b);
  const warm = h >= 5 && h <= 50 && s > 25;    // orange-ish accents would blend with the orange event dots
  const blueish = h >= 195 && h <= 255 && s > 30; // blue accents would blend with the blue task dots
  const vars = {
    '--gold': accent,
    '--gold-tint': `rgba(${r}, ${g}, ${b}, 0.12)`,
    '--gold-glow': `rgba(${r}, ${g}, ${b}, 0.28)`,
    '--bronze': hslToHex(h - 8, s * 0.7, isLight ? l - 8 : l - 12),
    '--champagne': hslToHex(h + 6, s * 0.8, isLight ? Math.min(l + 18, 62) : Math.min(l + 22, 88)),
    '--silver': hslToHex(h, Math.min(s, 14), isLight ? 48 : 64),
    '--copper': warm ? (isLight ? '#c98a1a' : '#f0c24a') : '#d9733a',
    '--blue': blueish ? (isLight ? '#0e8fb5' : '#7fd6ff') : (isLight ? '#2f6fd6' : '#5b9cff')
  };
  if (!isLight) vars['--bg-glow'] = hslToHex(h, Math.min(s * 0.5, 35), 10);
  return vars;
}

// Little round preview of a preset, used on the theme buttons in Settings
function themeSwatch(id) {
  const [h, s, l] = rgbToHsl(...hexToRgb(THEMES[id].dark.accent));
  return `linear-gradient(135deg, ${hslToHex(h, s, Math.min(l + 16, 92))}, ${hslToHex(h, s, Math.max(l - 14, 8))})`;
}

// ---------- Apply ----------
let appliedVars = [];
let current = null; // the last theme / mode / custom colour that was applied

// "system" becomes dark or light depending on what the PC is set to right now
function effectiveMode(mode) {
  if (mode !== 'system') return mode;
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

function applyTheme(theme, mode, custom) {
  if (theme !== 'custom' && !Object.prototype.hasOwnProperty.call(THEMES, theme)) theme = 'gold';
  if (!MODES.includes(mode)) mode = 'dark';
  if (!isHex(custom)) custom = DEFAULT_CUSTOM;
  current = { theme, mode, custom };
  const shown = effectiveMode(mode); // 'dark' or 'light', never 'system'
  const isLight = shown === 'light';

  let vars;
  if (theme === 'custom') {
    vars = deriveVars(fitAccent(custom, isLight), isLight);
  } else {
    const t = THEMES[theme][shown];
    vars = Object.assign(deriveVars(t.accent, isLight), t.vars || {});
  }

  const root = document.documentElement;
  appliedVars.forEach(k => root.style.removeProperty(k)); // clear the previous theme first
  appliedVars = Object.keys(vars);
  appliedVars.forEach(k => root.style.setProperty(k, vars[k]));
  root.dataset.theme = theme;
  root.dataset.mode = shown; // the light-mode colours in style.css switch on this

  // Remembered here too, so the next start shows the right colours instantly (no flash while data.json loads)
  try {
    localStorage.setItem('zaal-theme', theme);
    localStorage.setItem('zaal-mode', mode);
    localStorage.setItem('zaal-custom', custom);
  } catch (e) { /* not important */ }
}

(function () {
  let theme, mode, custom;
  try {
    theme = localStorage.getItem('zaal-theme');
    mode = localStorage.getItem('zaal-mode');
    custom = localStorage.getItem('zaal-custom');
  } catch (e) { /* not important */ }
  applyTheme(theme, mode, custom);

  // When the PC switches between dark and light, follow it (only if "Match system" is chosen)
  window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => {
    if (current && current.mode === 'system') applyTheme(current.theme, current.mode, current.custom);
  });
})();
