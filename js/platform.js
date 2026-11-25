// ==========================================================
// platform.js - lets the same pages run on a phone (Capacitor), in a browser and in the "npm start" preview.
// Everything the app needs from the device goes through window.pc:
//   loadData / saveData        - tasks, events, notes and settings, kept in the app's own storage
//   getVersion                 - the number shown at the bottom of the menu
//   weatherGeocode / weatherNow - Open-Meteo (free, no account needed)
// Loaded first, from the <head> of index.html.
// ==========================================================

const ZAAL_MINI_VERSION = '0.1.0';
const DATA_KEY = 'zaal-mini-data';

const weatherError = e => (e && e.message === 'Failed to fetch' ? 'Could not reach the weather service' : (e && e.message) || 'Weather problem');

window.pc = {
  getVersion: async () => ZAAL_MINI_VERSION,

  // Saved data (tasks, events, note, settings). Stays on the phone, inside the app.
  loadData: async () => {
    try { return JSON.parse(localStorage.getItem(DATA_KEY)) || { tasks: [], events: [], gcal: [] }; }
    catch (e) { return { tasks: [], events: [], gcal: [] }; }
  },
  saveData: async data => {
    try { localStorage.setItem(DATA_KEY, JSON.stringify(data)); return true; }
    catch (e) { return false; }
  },

  // Weather
  weatherGeocode: async name => {
    try {
      const res = await fetch('https://geocoding-api.open-meteo.com/v1/search?' + new URLSearchParams({ name, count: '1', language: 'en', format: 'json' }));
      const j = await res.json();
      const p = j.results && j.results[0];
      if (!p) return { error: 'City not found' };
      return { name: p.name + (p.country ? ', ' + p.country : ''), lat: p.latitude, lon: p.longitude };
    } catch (e) {
      return { error: weatherError(e) };
    }
  },
  weatherNow: async (lat, lon) => {
    try {
      const res = await fetch('https://api.open-meteo.com/v1/forecast?' + new URLSearchParams({
        latitude: String(lat),
        longitude: String(lon),
        current: 'temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m',
        daily: 'temperature_2m_max,temperature_2m_min',
        timezone: 'auto',
        forecast_days: '1'
      }));
      const j = await res.json();
      if (!j.current) throw new Error(j.reason || 'No weather data');
      return {
        temp: j.current.temperature_2m,
        feels: j.current.apparent_temperature,
        humidity: j.current.relative_humidity_2m,
        wind: j.current.wind_speed_10m,
        code: j.current.weather_code,
        hi: j.daily.temperature_2m_max[0],
        lo: j.daily.temperature_2m_min[0]
      };
    } catch (e) {
      return { error: weatherError(e) };
    }
  }
};
