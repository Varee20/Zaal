// ==========================================================
// swipe.js - swipe actions on list rows, plus the little message ("toast") that confirms them.
//
//   swipeRow(content, { right: action, left: [action, action, ...] })  ->  a <li> to put in a list
//     right  = what happens when you swipe toward the end of the row (usually "Done")
//     left   = the buttons that slide out when you swipe the other way (Snooze, Tomorrow, Priority, ...)
//     action = { label, icon, cls, fn }
//   Swipe from the start side for the main action, or from the end side to open the buttons.
//   In right-to-left languages everything is mirrored. Taps on buttons and boxes inside the row still work.
// ==========================================================

let openSwipe = null; // only one row keeps its buttons open

document.addEventListener('pointerdown', e => {
  if (openSwipe && !openSwipe.li.contains(e.target)) openSwipe.close();
}, true);

function swipeRow(content, cfg) {
  const right = cfg.right || null;
  const left = cfg.left || [];
  const TRAY = 76;                // width of one button
  const trayW = TRAY * left.length;
  const GO = 96;                  // how far to swipe for the main action

  const li = el('li', 'swrap');
  content.classList.add('sw-body');
  li.append(content);

  // main action, shown behind the row while swiping toward the end
  let bg = null;
  if (right) {
    bg = el('div', 'sw-bg ' + (right.cls || ''));
    bg.innerHTML = icon(right.icon) + '<span>' + right.label + '</span>';
    li.prepend(bg);
  }

  // buttons, shown behind the row while swiping the other way
  let tray = null;
  if (left.length) {
    tray = el('div', 'sw-tray');
    tray.style.width = trayW + 'px';
    left.forEach(a => {
      const b = el('button', 'sw-act ' + (a.cls || ''));
      b.type = 'button';
      b.innerHTML = icon(a.icon) + '<span>' + a.label + '</span>';
      b.onclick = e => { e.stopPropagation(); api.close(); a.fn(); };
      tray.append(b);
    });
    li.prepend(tray);
  }

  let x0 = 0, y0 = 0, base = 0, pos = 0, id = null, tracking = false, dragging = false, isOpen = false, swallow = false;
  const sign = () => (isRtl() ? -1 : 1); // physical direction of "toward the end"

  function setPos(p, animate) {
    pos = p;
    content.style.transition = animate ? '' : 'none';
    content.style.transform = p ? 'translateX(' + (p * sign()) + 'px)' : '';
    if (bg) {
      bg.style.opacity = p > 0 ? Math.min(1, p / 60) : 0;
      bg.classList.toggle('armed', p >= GO);
    }
    if (tray) tray.style.opacity = p < 0 ? 1 : 0;
  }

  const api = {
    li,
    close() { isOpen = false; setPos(0, true); if (openSwipe === api) openSwipe = null; },
    open() {
      if (openSwipe && openSwipe !== api) openSwipe.close();
      isOpen = true; setPos(-trayW, true); openSwipe = api;
    }
  };

  content.style.touchAction = 'pan-y';

  content.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    if (e.target.closest('input, button, select, textarea, a, .dd, .num')) { if (isOpen) api.close(); return; }
    if (openSwipe && openSwipe !== api) openSwipe.close();
    x0 = e.clientX; y0 = e.clientY; id = e.pointerId;
    base = isOpen ? -trayW : 0;
    tracking = true; dragging = false;
  });

  content.addEventListener('pointermove', e => {
    if (!tracking || e.pointerId !== id) return;
    const dx = (e.clientX - x0) * sign();
    const dy = e.clientY - y0;
    if (!dragging) {
      if (Math.abs(dx) < 8) return;
      if (Math.abs(dy) > Math.abs(dx)) { tracking = false; return; } // the finger is scrolling the page
      dragging = true;
      try { content.setPointerCapture(id); } catch (err) { /* fine */ }
      li.classList.add('swiping');
    }
    const min = left.length ? -trayW - 20 : 0;
    const max = right ? GO + 60 : 0;
    setPos(Math.min(max, Math.max(min, base + dx)), false);
  });

  function end(e) {
    if (!tracking || e.pointerId !== id) return;
    tracking = false;
    li.classList.remove('swiping');
    if (!dragging) { if (isOpen) api.close(); return; } // a tap on an open row closes it
    dragging = false;
    swallow = true;
    setTimeout(() => { swallow = false; }, 60);
    if (e.type === 'pointercancel') { isOpen ? api.open() : api.close(); return; }
    if (right && pos >= GO) {
      // fly out, then run the action (the list redraws itself)
      setPos(content.offsetWidth, true);
      setTimeout(() => right.fn(), 140);
    } else if (left.length && pos <= -trayW * 0.45) {
      api.open();
    } else {
      api.close();
    }
  }
  content.addEventListener('pointerup', end);
  content.addEventListener('pointercancel', end);

  // the click that follows a drag must not press anything
  li.addEventListener('click', e => { if (swallow) { e.preventDefault(); e.stopPropagation(); } }, true);

  return li;
}

// ---------- Toast: a short message at the bottom ----------
let toastTimer = null;
function toast(message) {
  let box = $('toast');
  if (!box) {
    box = el('div', 'toast');
    box.id = 'toast';
    document.body.append(box);
  }
  box.textContent = message;
  box.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => box.classList.remove('show'), 2200);
}
