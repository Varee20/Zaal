// ==========================================================
// weather.js - the Weather card (free Open-Meteo service, no account needed).
// You type your city once and it is remembered.
// ==========================================================

const WEATHER_CODES = {
  0: 'Clear sky', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
  45: 'Fog', 48: 'Freezing fog',
  51: 'Light drizzle', 53: 'Drizzle', 55: 'Heavy drizzle', 56: 'Freezing drizzle', 57: 'Heavy freezing drizzle',
  61: 'Light rain', 63: 'Rain', 65: 'Heavy rain', 66: 'Freezing rain', 67: 'Heavy freezing rain',
  71: 'Light snow', 73: 'Snow', 75: 'Heavy snow', 77: 'Snow grains',
  80: 'Light showers', 81: 'Showers', 82: 'Violent showers', 85: 'Snow showers', 86: 'Heavy snow showers',
  95: 'Thunderstorm', 96: 'Thunderstorm with hail', 99: 'Thunderstorm with heavy hail'
};

function showWeatherSetup(show) {
  $('w-set').style.display = show ? 'flex' : 'none';
  $('w-view').style.display = show ? 'none' : 'block';
}

async function loadWeather() {
  const city = data.settings.city;
  if (!city) return;
  $('w-msg').textContent = 'Updating...';
  const r = await window.pc.weatherNow(city.lat, city.lon);
  if (r.error) { $('w-msg').textContent = 'Could not load weather: ' + r.error; return; }

  const deg = n => Math.round(n) + '\u00b0';
  $('w-temp').textContent = deg(r.temp);
  $('w-desc').textContent = WEATHER_CODES[r.code] || 'Unknown';
  $('w-place').textContent = city.name;
  $('w-more').textContent = 'Feels like ' + deg(r.feels) + '  |  H ' + deg(r.hi) + '  L ' + deg(r.lo) +
    '  |  ' + Math.round(r.humidity) + '% humidity  |  wind ' + Math.round(r.wind) + ' km/h';
  $('w-msg').textContent = '';
}

async function setCity() {
  const name = $('w-city').value.trim();
  if (!name) return;
  $('w-msg').textContent = 'Searching...';
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
