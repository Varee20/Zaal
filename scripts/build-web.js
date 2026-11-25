// ==========================================================
// build-web.js - copies the app's web files (index.html, css, js) into "www", the folder Capacitor packs into the phone app.
// Run by the Android workflow (.github/workflows/android.yml), or by hand with: npm run build:web
// ==========================================================

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const out = path.join(root, 'www');

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

['index.html', 'css', 'js'].forEach(name => {
  fs.cpSync(path.join(root, name), path.join(out, name), { recursive: true });
});

console.log('Web files copied to www/');
