// ==========================================================
// quick.js - the quick action buttons in the top bar (lock, sleep, restart, shut down, Task Manager).
// Restart and shut down ask for confirmation first (see main.js).
// ==========================================================

function initQuick() {
  document.querySelectorAll('.qbtn').forEach(b => {
    b.onclick = () => window.pc.quickAction(b.dataset.a);
  });
}
