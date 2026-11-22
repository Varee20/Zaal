// ==========================================================
// ui.js - Zaal's own form controls, so nothing looks like the system's default controls:
//   enhanceSelect  - a dropdown that follows the theme (replaces <select>)
//   enhanceNumber  - a number box with themed up/down buttons (replaces <input type="number">)
//   attachSuggest  - a suggestion list under a text box (replaces <datalist>)
//   icon           - small line icons used across the app
// Loaded right after core.js. initUI() runs from app.js.
// ==========================================================

// ---------- Icons ----------
const ICONS = {
  dash: '<rect x="3" y="3" width="7" height="9" rx="1.8"/><rect x="14" y="3" width="7" height="5" rx="1.8"/><rect x="14" y="12" width="7" height="9" rx="1.8"/><rect x="3" y="16" width="7" height="5" rx="1.8"/>',
  tasks: '<path d="M9 6h11M9 12h11M9 18h11"/><path d="M3.5 6l1.5 1.5L7.5 5M3.5 12l1.5 1.5L7.5 11M3.5 18l1.5 1.5L7.5 17"/>',
  cal: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  ai: '<path d="M11 3l1.9 5.1L18 10l-5.1 1.9L11 17l-1.9-5.1L4 10l5.1-1.9z"/><path d="M18.5 15l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z"/>',
  settings: '<path d="M3 6h9M18 6h3M3 12h3M12 12h9M3 18h11M20 18h1"/><circle cx="15" cy="6" r="2.3"/><circle cx="9" cy="12" r="2.3"/><circle cx="17" cy="18" r="2.3"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>',
  edit: '<path d="M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17z"/><path d="M14 7l3 3"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  up: '<path d="M6 15l6-6 6 6"/>',
  down: '<path d="M6 9l6 6 6-6"/>',
  left: '<path d="M15 6l-6 6 6 6"/>',
  right: '<path d="M9 6l6 6-6 6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  send: '<path d="M21 3L10 14"/><path d="M21 3l-7 18-4-8-8-4z"/>'
};

function icon(name) {
  return '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true">' + (ICONS[name] || '') + '</svg>';
}

// ---------- Dropdown (replaces <select>) ----------
// The real <select> stays on the page, hidden, so the rest of the code keeps using select.value and
// the "change" event exactly as before. This only draws the button and the list.
let openDropdown = null; // only one list is open at a time

document.addEventListener('mousedown', e => {
  if (openDropdown && !openDropdown.root.contains(e.target)) openDropdown.close();
});
window.addEventListener('blur', () => { if (openDropdown) openDropdown.close(); });

function enhanceSelect(select) {
  if (select._dd) return select._dd.root;

  const root = el('div', 'dd');
  select.classList.forEach(c => { if (c !== 'inp' && c !== 'dsel') root.classList.add(c); }); // size classes move to the wrapper
  const btn = el('button', 'dd-btn');
  btn.type = 'button';
  const label = el('span', 'dd-label');
  const caret = el('span', 'dd-caret');
  caret.innerHTML = icon('down');
  btn.append(label, caret);
  const menu = el('div', 'dd-menu');
  menu.hidden = true;

  let active = -1;   // the highlighted row in the open list
  let typed = '';    // type-ahead text ("14" jumps to 1404...)
  let typedTimer = null;

  // Shows the chosen option on the button
  function sync() {
    const o = select.options[select.selectedIndex];
    label.textContent = o ? o.textContent : '';
    btn.classList.toggle('placeholder', !!o && o.value === '');
  }

  function highlight(i) {
    active = i;
    Array.from(menu.children).forEach((c, k) => c.classList.toggle('hl', k === i));
    if (menu.children[i]) menu.children[i].scrollIntoView({ block: 'nearest' });
  }

  function build() {
    menu.innerHTML = '';
    Array.from(select.options).forEach((o, i) => {
      const row = el('div', 'dd-opt' + (o.value === '' ? ' ph' : '') + (i === select.selectedIndex ? ' on' : ''), o.textContent);
      row.onmousedown = e => { e.preventDefault(); choose(i); };
      row.onmousemove = () => { if (active !== i) highlight(i); };
      menu.append(row);
    });
  }

  function open() {
    if (openDropdown && openDropdown !== api) openDropdown.close();
    build();
    menu.hidden = false;
    root.classList.add('open');
    root.classList.remove('up');
    const r = btn.getBoundingClientRect();
    const h = Math.min(menu.scrollHeight, 264);
    if (r.bottom + h + 14 > window.innerHeight && r.top > h + 14) root.classList.add('up'); // no room below, open upward
    highlight(Math.max(select.selectedIndex, 0));
    openDropdown = api;
  }

  function close() {
    menu.hidden = true;
    root.classList.remove('open');
    if (openDropdown === api) openDropdown = null;
  }

  function choose(i) {
    if (i >= 0 && i < select.options.length) {
      const changed = select.selectedIndex !== i;
      select.selectedIndex = i;
      if (changed) select.dispatchEvent(new Event('change', { bubbles: true }));
    }
    close();
    btn.focus();
  }

  btn.onclick = () => (menu.hidden ? open() : close());
  btn.onkeydown = e => {
    const n = select.options.length;
    if (menu.hidden) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) { e.preventDefault(); open(); }
      return;
    }
    if (e.key === 'ArrowDown') { e.preventDefault(); highlight(Math.min(active + 1, n - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); highlight(Math.max(active - 1, 0)); }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(active); }
    else if (e.key === 'Escape') { e.preventDefault(); close(); }
    else if (e.key === 'Tab') { close(); }
    else if (e.key.length === 1) {
      typed += e.key.toLowerCase();
      clearTimeout(typedTimer);
      typedTimer = setTimeout(() => { typed = ''; }, 700);
      const hit = Array.from(select.options).findIndex(o => o.textContent.toLowerCase().startsWith(typed));
      if (hit >= 0) highlight(hit);
    }
  };

  // When other code sets select.value or select.selectedIndex, the button follows
  ['value', 'selectedIndex'].forEach(prop => {
    const desc = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, prop);
    Object.defineProperty(select, prop, {
      configurable: true,
      get() { return desc.get.call(this); },
      set(v) { desc.set.call(this, v); sync(); }
    });
  });
  new MutationObserver(sync).observe(select, { childList: true, subtree: true }); // options were replaced

  if (select.parentNode) select.parentNode.replaceChild(root, select);
  select.style.display = 'none';
  root.append(btn, menu, select);
  sync();

  const api = { root, open, close };
  select._dd = api;
  return root;
}

// ---------- Number box (replaces <input type="number">) ----------
// Works for hours and minutes: arrow keys, mouse wheel, and the little up/down buttons.
// Past the last number it wraps around (12 -> 1, 59 -> 0). Add data-pad="1" to show 05 instead of 5.
function enhanceNumber(input) {
  if (input._num) return input.parentNode;

  const min = Number(input.getAttribute('min') || 0);
  const max = Number(input.getAttribute('max') || 99);
  const show = v => (input.dataset.pad ? pad(v) : String(v));

  input.type = 'text';
  input.inputMode = 'numeric';
  input.autocomplete = 'off';
  input._num = true;

  function step(dir) {
    let v = parseInt(input.value, 10);
    if (isNaN(v)) v = dir > 0 ? min - 1 : max + 1; // empty box: up gives the first number, down the last
    v += dir;
    if (v > max) v = min;
    if (v < min) v = max;
    input.value = show(v);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }

  input.addEventListener('input', () => {
    const clean = input.value.replace(/\D/g, '').slice(0, 2);
    if (clean !== input.value) input.value = clean;
  });
  input.addEventListener('blur', () => {
    if (input.value === '') return;
    const v = Math.min(Math.max(parseInt(input.value, 10) || 0, min), max);
    input.value = show(v);
  });
  input.addEventListener('keydown', e => {
    if (e.key === 'ArrowUp') { e.preventDefault(); step(1); }
    if (e.key === 'ArrowDown') { e.preventDefault(); step(-1); }
  });
  input.addEventListener('wheel', e => {
    if (document.activeElement !== input) return;
    e.preventDefault();
    step(e.deltaY < 0 ? 1 : -1);
  }, { passive: false });

  const root = el('div', 'num');
  const steps = el('div', 'num-steps');
  [['up', 1, 'Increase'], ['down', -1, 'Decrease']].forEach(([name, dir, tip]) => {
    const b = el('button', 'num-btn');
    b.type = 'button';
    b.tabIndex = -1;
    b.title = tip;
    b.innerHTML = icon(name);
    b.onmousedown = e => e.preventDefault(); // keeps the cursor in the box
    b.onclick = () => step(dir);
    steps.append(b);
  });

  if (input.parentNode) input.parentNode.replaceChild(root, input);
  root.append(input, steps);
  return root;
}

// ---------- Suggestions under a text box (replaces <datalist>) ----------
function attachSuggest(input, getList) {
  const root = el('div', 'combo');
  const menu = el('div', 'dd-menu');
  menu.hidden = true;
  let items = [];
  let active = -1;

  function highlight(i) {
    active = i;
    Array.from(menu.children).forEach((c, k) => c.classList.toggle('hl', k === i));
  }

  function pick(text) {
    input.value = text;
    menu.hidden = true;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function show() {
    const q = input.value.trim().toLowerCase();
    items = getList().filter(c => c.toLowerCase().includes(q) && c.toLowerCase() !== q);
    menu.innerHTML = '';
    active = -1;
    if (!items.length) { menu.hidden = true; return; }
    items.forEach((c, i) => {
      const row = el('div', 'dd-opt', c);
      row.onmousedown = e => { e.preventDefault(); pick(c); };
      row.onmousemove = () => highlight(i);
      menu.append(row);
    });
    menu.hidden = false;
  }

  input.addEventListener('input', show);
  input.addEventListener('focus', show);
  input.addEventListener('blur', () => { menu.hidden = true; });
  input.addEventListener('keydown', e => {
    if (menu.hidden) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); highlight(Math.min(active + 1, items.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); highlight(Math.max(active - 1, 0)); }
    else if (e.key === 'Enter' && active >= 0) { e.preventDefault(); e.stopImmediatePropagation(); pick(items[active]); }
    else if (e.key === 'Escape') { menu.hidden = true; }
  });

  if (input.parentNode) input.parentNode.replaceChild(root, input);
  root.append(input, menu);
  return root;
}

// ---------- Start-up: dress up the parts that are already in index.html ----------
function initUI() {
  // dashed outer ring on every gauge
  document.querySelectorAll('.card svg').forEach(svg => {
    svg.insertAdjacentHTML('afterbegin', '<circle class="ticks" cx="60" cy="60" r="58"/>');
  });

  // sidebar icons
  document.querySelectorAll('nav button[data-v]').forEach(b => b.insertAdjacentHTML('afterbegin', icon(b.dataset.v)));
  $('q').parentNode.insertAdjacentHTML('afterbegin', icon('search').replace('class="ico"', 'class="ico sico"'));

  // buttons that used text arrows
  $('c-prev').innerHTML = icon('left');
  $('c-next').innerHTML = icon('right');
  $('chat-send').innerHTML = icon('send');

  // number boxes, dropdowns and the category suggestions
  ['t-hh', 't-mm', 'e-hh', 'e-mm'].forEach(id => enhanceNumber($(id)));
  ['t-ap', 'e-ap', 'ai-model'].forEach(id => enhanceSelect($(id)));
  $('ai-model').closest('.dd').style.display = 'none'; // shown by ai.js once there is more than one model
  attachSuggest($('t-cat'), taskCategories);

  if (typeof setDrawer === 'function') setDrawer(false); // draws the arrow on the Today panel handle

  // version number at the bottom of the sidebar
  if (window.pc && window.pc.getVersion) window.pc.getVersion().then(v => { $('ver').textContent = 'v' + v; }).catch(() => {});
}
