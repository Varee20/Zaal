// ==========================================================
// navdrawer.js - the menu drawer (Zaal mini). It pulls out from the left, or from the right in
// right-to-left languages (Persian, Arabic).
// Open it with the menu button, or tap / drag the pull tab on the screen edge.
// Close it by tapping outside, dragging it back, pressing Esc, or picking a page.
// While you drag, the drawer follows your finger and snaps open or shut when you let go.
// ==========================================================

function setNav(open) {
  document.body.classList.toggle('nav-open', open);
  const h = $('nav-handle');
  if (h) h.setAttribute('aria-expanded', open ? 'true' : 'false');
}

// The arrow on the pull tab points into the screen, so it flips with the direction
function navArrow() {
  const h = $('nav-handle');
  if (h) h.innerHTML = icon(isRtl() ? 'left' : 'right');
}

function initNavDrawer() {
  const body = document.body;
  const nav = $('nav');
  const scrim = $('nav-scrim');
  const handle = $('nav-handle');
  let g = null;              // the drag that is happening right now
  let swallowClick = false;  // stops the click that comes right after a drag
  const sign = () => (isRtl() ? -1 : 1); // +1: the drawer comes from the left, -1: from the right

  navArrow();
  $('nav-open').innerHTML = icon('menu');
  $('nav-open').onclick = () => setNav(true);
  handle.onclick = e => { if (e.detail === 0) setNav(true); }; // keyboard only; touch and mouse are handled below
  scrim.onclick = () => { if (!swallowClick) setNav(false); };
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && body.classList.contains('nav-open')) setNav(false);
  });

  // p = how open the drawer is: 0 (shut) to 1 (open)
  function paint(p) {
    nav.style.transform = 'translateX(' + (sign() * (p - 1) * 100) + '%)';
    scrim.style.opacity = p;
    handle.style.opacity = 1 - p;
  }

  function begin(e, startP, el) {
    g = {
      id: e.pointerId, el, x0: e.clientX, y0: e.clientY, p0: startP, p: startP,
      w: nav.offsetWidth || 260, lastX: e.clientX, lastT: e.timeStamp, v: 0, moved: false, captured: false
    };
    if (el === handle) { handle.setPointerCapture(e.pointerId); g.captured = true; } // the tab is tiny, keep hold of the finger
  }

  function move(e) {
    if (!g || e.pointerId !== g.id) return;
    const dx = (e.clientX - g.x0) * sign();
    if (!g.moved) {
      if (Math.abs(dx) < 8) return; // a tap is not a drag
      g.moved = true;
      body.classList.add('nav-drag');
      if (!g.captured) { try { g.el.setPointerCapture(g.id); g.captured = true; } catch (err) { /* fine */ } }
    }
    g.p = Math.min(1, Math.max(0, g.p0 + dx / g.w));
    const dt = e.timeStamp - g.lastT;
    if (dt > 0) g.v = ((e.clientX - g.lastX) / dt) * sign(); // speed in px per ms, positive = opening
    g.lastX = e.clientX;
    g.lastT = e.timeStamp;
    paint(g.p);
  }

  function end(e) {
    if (!g || e.pointerId !== g.id) return;
    const done = g;
    g = null;
    if (!done.moved) {
      if (done.el === handle && e.type === 'pointerup') setNav(true); // a tap on the tab opens the drawer
      return;
    }
    body.classList.remove('nav-drag');
    nav.style.transform = scrim.style.opacity = handle.style.opacity = '';
    let open = done.p > 0.5;
    if (Math.abs(done.v) > 0.5) open = done.v > 0; // a quick flick wins over the halfway mark
    if (e.type === 'pointercancel') open = done.p0 === 1; // the browser took over: go back to where it was
    setNav(open);
    swallowClick = true;
    setTimeout(() => { swallowClick = false; }, 60);
  }

  // Drag the tab to pull the drawer out; drag the drawer or the dark area to push it back
  handle.addEventListener('pointerdown', e => { if (e.button === 0) begin(e, 0, handle); });
  nav.addEventListener('pointerdown', e => { if (e.button === 0 && body.classList.contains('nav-open')) begin(e, 1, nav); });
  scrim.addEventListener('pointerdown', e => { if (e.button === 0 && body.classList.contains('nav-open')) begin(e, 1, scrim); });
  [handle, nav, scrim].forEach(x => {
    x.addEventListener('pointermove', move);
    x.addEventListener('pointerup', end);
    x.addEventListener('pointercancel', end);
  });
}
