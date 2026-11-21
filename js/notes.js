// ==========================================================
// notes.js - the Quick note box. Saves by itself half a second after you stop typing.
// ==========================================================

let noteTimer = null;

function initNotes() {
  $('note').oninput = () => {
    clearTimeout(noteTimer);
    noteTimer = setTimeout(() => { data.note = $('note').value; save(); }, 500);
  };
}

function startNotes() {
  $('note').value = data.note || '';
}
