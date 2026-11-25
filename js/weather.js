// ==========================================================
// weather.js - the Weather card (free Open-Meteo service, no account needed).
// You type your city once and it is remembered.
// ==========================================================

// Weather code -> a short description in the chosen language (grouped to keep the translations small)
function weatherText(code) {
  if (code <= 1) return tr('wx.clear');
  if (code === 2) return tr('wx.partly');
  if (code === 3) return tr('wx.overcast');
  if (code === 45 || code === 48) return tr('wx.fog');
  if (code >= 51 && code <= 57) return tr('wx.drizzle');
  if (code >= 61 && code <= 67) return tr('wx.rain');
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return tr('wx.snow');
  if (code >= 80 && code <= 82) return tr('wx.showers');
  if (code >= 95) return tr('wx.thunder');
  return tr('wx.unknown');
}

let lastWeather = null; // kept so a language change can redraw without asking the service again

function showWeatherSetup(show) {
  $('w-set').style.display = show ? 'flex' : 'none';
  $('w-view').style.display = show ? 'none' : 'block';
}

function drawWeather() {
  const r = lastWeather;
  const city = data.settings.city;
  if (!r || !city) return;
  const deg = n => Math.round(n) + '\u00b0';
  $('w-temp').textContent = deg(r.temp);
  $('w-desc').textContent = weatherText(r.code);
  $('w-place').textContent = city.name;
  $('w-more').textContent = tr('weather.more', {
    feels: deg(r.feels), hi: deg(r.hi), lo: deg(r.lo), hum: Math.round(r.humidity), wind: Math.round(r.wind)
  });
}

async function loadWeather() {
  const city = data.settings.city;
  if (!city) return;
  $('w-msg').textContent = tr('weather.updating');
  const r = await window.pc.weatherNow(city.lat, city.lon);
  if (r.error) { $('w-msg').textContent = tr('weather.fail', { e: r.error }); return; }
  lastWeather = r;
  drawWeather();
  $('w-msg').textContent = '';
}

async function setCity() {
  const name = $('w-city').value.trim();
  if (!name) return;
  $('w-msg').textContent = tr('weather.searching');
  const r = await window.pc.weatherGeocode(name);
  if (r.error) { $('w-msg').textContent = r.error; return; }
  data.settings.city = { name: r.name, lat: r.lat, lon: r.lon };
  save();
  $('w-city').value = '';
  showWeatherSetup(false);
  loadWeather();
}

function initWeather() {
  $('w-go').onclick = setCity;
  $('w-city').onkeydown = e => { if (e.key === 'Enter') setCity(); };
  $('w-change').onclick = () => { showWeatherSetup(true); $('w-city').focus(); };
}

function startWeather() {
  showWeatherSetup(!data.settings.city);
  if (data.settings.city) loadWeather();
  setInterval(() => { if (data.settings.city) loadWeather(); }, 30 * 60 * 1000);
}
