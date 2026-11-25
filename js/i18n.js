// ==========================================================
// i18n.js - the language chooser's engine.
//   t('key')              -> the text in the chosen language (falls back to English)
//   t('key', { n: 3 })    -> fills the {n} spots in the text
//   data-i18n="key"       -> in index.html: the element's text   (also data-i18n-ph = placeholder, data-i18n-title = tooltip)
//   setLanguage('fa')     -> switches the app (the layout flips to right-to-left for Persian and Arabic)
// The words themselves live in js/langs.js. Loaded in <head>, so the language is right before the page draws.
// ==========================================================

const LANGS = {
  en: { native: 'English', dir: 'ltr', locale: 'en-US' },
  fa: { native: 'فارسی', dir: 'rtl', locale: 'fa-IR' },
  ar: { native: 'العربية', dir: 'rtl', locale: 'ar' },
  tr: { native: 'Türkçe', dir: 'ltr', locale: 'tr-TR' },
  ru: { native: 'Русский', dir: 'ltr', locale: 'ru-RU' },
  es: { native: 'Español', dir: 'ltr', locale: 'es-ES' },
  fr: { native: 'Français', dir: 'ltr', locale: 'fr-FR' },
  de: { native: 'Deutsch', dir: 'ltr', locale: 'de-DE' }
};

let LANG = 'en';
try {
  const saved = localStorage.getItem('zaal-lang');
  if (saved && LANGS[saved]) LANG = saved;
} catch (e) { /* not important */ }

const isRtl = () => LANGS[LANG].dir === 'rtl';

function t(key, vars) {
  let s = (STR[LANG] && STR[LANG][key]);
  if (s === undefined) s = STR.en[key];
  if (s === undefined) s = key;
  if (vars) s = s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] !== undefined ? vars[k] : m));
  return s;
}

// Same thing under a second name, for code where a variable called t (a task, a time) would hide t()
const tr = t;

// Locale for dates and weekdays. Digits stay 0-9 in every language; "cal" picks the calendar system.
function langLocale(cal) {
  return LANGS[LANG].locale + '-u-' + (cal ? 'ca-' + cal + '-' : '') + 'nu-latn';
}

// Writes the chosen language into every element that has a data-i18n attribute, and sets the text direction
function applyI18n() {
  const root = document.documentElement;
  root.lang = LANG;
  root.dir = LANGS[LANG].dir;
  root.style.setProperty('--empty-text', JSON.stringify(t('empty')));
  document.querySelectorAll('[data-i18n]').forEach(n => { n.textContent = t(n.dataset.i18n); });
  document.querySelectorAll('[data-i18n-ph]').forEach(n => { n.placeholder = t(n.dataset.i18nPh); });
  document.querySelectorAll('[data-i18n-title]').forEach(n => { n.title = t(n.dataset.i18nTitle); });
}

function setLanguage(code) {
  if (!LANGS[code]) code = 'en';
  LANG = code;
  try { localStorage.setItem('zaal-lang', code); } catch (e) { /* not important */ }
  applyI18n();
}

// Right direction and language from the very first frame
document.documentElement.lang = LANG;
document.documentElement.dir = LANGS[LANG].dir;
