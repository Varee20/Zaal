// ==========================================================
// calsys.js - the calendar systems you can pick as your default in Settings:
// American (Gregorian), Persian and Islamic. Month names are in English.
// Dates are always stored as normal (American) dates; this file only converts them for display.
// ==========================================================

const MONTH_NAMES = {
  american: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  persian: ['Farvardin', 'Ordibehesht', 'Khordad', 'Tir', 'Mordad', 'Shahrivar', 'Mehr', 'Aban', 'Azar', 'Dey', 'Bahman', 'Esfand'],
  islamic: ['Muharram', 'Safar', "Rabi' al-awwal", "Rabi' al-thani", 'Jumada al-awwal', 'Jumada al-thani', 'Rajab', "Sha'ban", 'Ramadan', 'Shawwal', "Dhu al-Qi'dah", 'Dhu al-Hijjah']
};

// Month names in the chosen language. Gregorian months come from the browser; the Persian and Islamic
// ones are written out in Persian / Arabic script when the app language is Persian or Arabic.
const MONTHS_PERSIAN_FA = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];
const MONTHS_ISLAMIC_AR = ['محرم', 'صفر', 'ربيع الأول', 'ربيع الآخر', 'جمادى الأولى', 'جمادى الآخرة', 'رجب', 'شعبان', 'رمضان', 'شوال', 'ذو القعدة', 'ذو الحجة'];

function monthNames(sys) {
  const script = LANG === 'fa' || LANG === 'ar';
  if (sys === 'persian' && script) return MONTHS_PERSIAN_FA;
  if (sys === 'islamic' && script) return MONTHS_ISLAMIC_AR;
  if (sys !== 'american') return MONTH_NAMES[sys];
  const f = new Intl.DateTimeFormat(langLocale('gregory'), { month: 'long' });
  return Array.from({ length: 12 }, (_, i) => f.format(new Date(2024, i, 15)));
}

// "-nu-latn" keeps the digits as normal 0-9
const CAL_LOCALES = {
  american: 'en-US-u-ca-gregory-nu-latn',
  persian: 'en-US-u-ca-persian-nu-latn',
  islamic: 'en-US-u-ca-islamic-civil-nu-latn'
};
const calFormatters = {};

// Year / month (1-12) / day of a date in the chosen calendar
function calParts(sys, date) {
  const f = calFormatters[sys] || (calFormatters[sys] = new Intl.DateTimeFormat(CAL_LOCALES[sys], { year: 'numeric', month: 'numeric', day: 'numeric' }));
  const o = {};
  f.formatToParts(date).forEach(p => { o[p.type] = p.value; });
  return { y: Number(o.year || o.relatedYear), m: Number(o.month), d: Number(o.day) };
}

const addDays = (date, n) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + n, 12);

// The first day of the month that contains this date (in the chosen calendar)
function monthFirst(sys, date) {
  return addDays(date, -(calParts(sys, date).d - 1));
}

// How many days that month has (29, 30 or 31)
function monthLength(sys, first) {
  const m = calParts(sys, first).m;
  let n = 1;
  while (n < 32 && calParts(sys, addDays(first, n)).m === m) n++;
  return n;
}

// "Saturday, 12 Aban" (American: "Thursday, November 19"). Add the year with withYear = true.
function fmtCalDate(sys, date, withYear) {
  const weekday = date.toLocaleDateString(langLocale('gregory'), { weekday: 'long' });
  const p = calParts(sys, date);
  const month = monthNames(sys)[p.m - 1];
  if (sys === 'american' && LANG === 'en') return weekday + ', ' + month + ' ' + p.d + (withYear ? ', ' + p.y : '');
  return weekday + ', ' + p.d + ' ' + month + (withYear ? ' ' + p.y : '');
}

// The real (American) date of a day in the chosen calendar, e.g. 12 Aban 1405 -> its normal date
function fromCalParts(sys, y, m, d) {
  const target = y * 10000 + m * 100 + d;
  const key = date => { const p = calParts(sys, date); return p.y * 10000 + p.m * 100 + p.d; };
  const base = new Date(1900, 0, 1, 12);
  let lo = 0, hi = 110000; // about 300 years of days
  if (key(addDays(base, lo)) > target || key(addDays(base, hi)) < target) return null;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (key(addDays(base, mid)) < target) lo = mid + 1; else hi = mid;
  }
  return addDays(base, lo);
}
