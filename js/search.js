// ==========================================================
// search.js - the search bar (tasks, events and page shortcuts). Ctrl+K focuses it.
// ==========================================================

const PAGES = [['Dashboard', 'dash'], ['Tasks', 'tasks'], ['Calendar', 'cal'], ['Settings', 'settings']];

function runSearch() {
  const q = $('q'), res = $('res');
  const term = q.value.trim().toLowerCase();
  res.innerHTML = '';
  if (!term) { res.style.display = 'none'; return; }

  const hits = [];
  PAGES.filter(p => p[0].toLowerCase().includes(term))
    .forEach(p => hits.push({ kind: 'Go to', text: p[0], go: () => showView(p[1]) }));
  data.tasks.filter(t => (t.text + ' ' + (t.category || '') + ' ' + (t.subs || []).map(s => s.text).join(' ')).toLowerCase().includes(term))
    .forEach(t => hits.push({ kind: 'Task', text: t.text, go: () => showView('tasks') }));
  allEvents().filter(e => e.title.toLowerCase().includes(term))
    .forEach(e => hits.push({ kind: 'Event', text: e.date + '   ' + e.title, go: () => { goToDate(e.date); showView('cal'); } }));

  if (!hits.length) res.append(el('div', 'hit muted', 'Nothing found'));
  hits.slice(0, 8).forEach(h => {
    const row = el('div', 'hit');
    row.append(el('span', 'kind', h.kind), el('span', '', h.text));
    row.onmousedown = ev => { ev.preventDefault(); h.go(); q.value = ''; runSearch(); q.blur(); };
    res.append(row);
  });
  res.style.display = 'block';
}

function initSearch() {
  const q = $('q'), res = $('res');
  q.oninput = runSearch;
  q.onfocus = runSearch;
  q.onblur = () => setTimeout(() => { res.style.display = 'none'; }, 150);
  document.addEventListener('keydown', e => {
    if (e.ctrlKey && e.key.toLowerCase() === 'k') { e.preventDefault(); q.focus(); }
    if (e.key === 'Escape') { q.value = ''; q.blur(); }
  });
}
