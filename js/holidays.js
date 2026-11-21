// ==========================================================
// holidays.js - holiday lists (Persian, Islamic, American).
// Everything is calculated with the browser's built-in calendars, no internet needed.
// ==========================================================

// Calendar converters. "-nu-latn" keeps the digits as normal 0-9 so we can compare them.
const fPer = new Intl.DateTimeFormat('en-US-u-ca-persian-nu-latn', { day: 'numeric', month: 'numeric' });
const fIsl = new Intl.DateTimeFormat('en-US-u-ca-islamic-civil-nu-latn', { day: 'numeric', month: 'numeric' });

// Month + day of a date in another calendar
function dateParts(formatter, date) {
  const o = {};
  formatter.formatToParts(date).forEach(p => { o[p.type] = p.value; });
  return { m: o.month, d: o.day };
}

// ---------- Holiday tables (keys are "month-day") ----------
const PERSIAN_HOLIDAYS = {
  '1-1': 'Nowruz (Persian New Year)', '1-2': 'Nowruz', '1-3': 'Nowruz', '1-4': 'Nowruz',
  '1-6': "Khordadsal (Zarathustra's Birthday)", '1-12': 'Islamic Republic Day', '1-13': 'Sizdah Bedar (Nature Day)',
  '1-19': 'Farvardingan', '1-25': 'Attar Day',
  '2-1': 'Saadi Day', '2-3': 'Ordibeheshtgan', '2-10': 'Persian Gulf National Day', '2-25': 'Ferdowsi Day', '2-28': 'Khayyam Day',
  '3-14': "Khomeini's Demise", '3-15': '15 Khordad Uprising',
  '4-13': 'Tirgan',
  '5-7': 'Amordadgan', '5-14': 'Constitutional Revolution Day',
  '6-1': 'Avicenna Day', '6-4': 'Shahrivargan',
  '7-8': 'Rumi Day', '7-16': 'Mehregan', '7-20': 'Hafez Day',
  '8-7': 'Cyrus the Great Day', '8-10': 'Abangan',
  '9-9': 'Azargan', '9-30': 'Shab-e Yalda',
  '10-8': 'Dey-be-Mehr',
  '11-2': 'Bahmangan', '11-10': 'Sadeh', '11-22': 'Revolution Victory Day',
  '12-5': 'Sepandarmazgan (Esfandegan)', '12-29': 'Oil Nationalization Day'
};

const ISLAMIC_HOLIDAYS = {
  '1-9': 'Tasua', '1-10': 'Ashura', '2-20': 'Arbaeen', '2-28': "Prophet Muhammad's Demise",
  '3-17': "Prophet's Birthday", '6-3': "Fatima's Martyrdom", '7-13': "Imam Ali's Birthday",
  '7-27': "Eid al-Mab'ath", '8-15': "Imam Mahdi's Birthday", '9-21': "Imam Ali's Martyrdom",
  '10-1': 'Eid al-Fitr', '10-2': 'Eid al-Fitr (2nd day)', '12-10': 'Eid al-Adha', '12-18': 'Eid al-Ghadir'
};

// American holidays move around (like "3rd Monday"), so they are calculated per year
const usCache = {};
function usHolidays(year) {
  if (usCache[year]) return usCache[year];
  // day-of-month of the n-th given weekday (0 = Sunday) in a month
  const nth = (m, weekday, n) => 1 + ((weekday - new Date(year, m, 1).getDay() + 7) % 7) + (n - 1) * 7;
  const lastMonday = m => { const last = new Date(year, m + 1, 0); return last.getDate() - ((last.getDay() - 1 + 7) % 7); };
  const h = {};
  h['0-1'] = "New Year's Day";
  h['0-' + nth(0, 1, 3)] = 'Martin Luther King Jr. Day';
  h['1-' + nth(1, 1, 3)] = "Presidents' Day";
  h['4-' + lastMonday(4)] = 'Memorial Day';
  h['5-19'] = 'Juneteenth';
  h['6-4'] = 'Independence Day';
  h['8-' + nth(8, 1, 1)] = 'Labor Day';
  h['9-' + nth(9, 1, 2)] = 'Columbus Day';
  h['10-11'] = 'Veterans Day';
  h['10-' + nth(10, 4, 4)] = 'Thanksgiving';
  h['11-25'] = 'Christmas Day';
  return (usCache[year] = h);
}

// All holidays on one date, based on which options are turned on in Settings -> Calendar -> Holidays
function holidaysFor(date) {
  const out = [];
  const add = t => { if (t && !out.includes(t)) out.push(t); };
  const y = date.getFullYear(), m = date.getMonth(), d = date.getDate();

  if (data.settings.us) add(usHolidays(y)[m + '-' + d]);

  if (data.settings.persian) {
    const p = dateParts(fPer, date);
    add(PERSIAN_HOLIDAYS[p.m + '-' + p.d]);
    // Chaharshanbe Suri: the Tuesday evening before the last Wednesday of the year
    if (date.getDay() === 2 && p.m === '12') {
      const wed = dateParts(fPer, new Date(date.getTime() + 86400000));
      const next = dateParts(fPer, new Date(date.getTime() + 8 * 86400000));
      if (wed.m === '12' && next.m === '1') add('Chaharshanbe Suri (tonight)');
    }
  }

  if (data.settings.islamic) {
    const i = dateParts(fIsl, date);
    add(ISLAMIC_HOLIDAYS[i.m + '-' + i.d]);
  }

  return out;
}
