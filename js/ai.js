// ==========================================================
// ai.js - the AI center: chat with the local assistant (Ollama) and the first-time setup popup.
// The assistant can only ask for the actions in ai-tools.js, and you approve each one.
// ==========================================================

let aiInfo = null;     // what the main process says about Ollama
let aiModel = '';      // the model in use
let aiReady = false;
let chatBusy = false;
let chatHistory = [];  // the last few plain messages, so follow-up questions work

const STEP_NAMES = {
  download: 'Downloading Ollama',
  verify: 'Checking the installer',
  install: 'Installing Ollama',
  start: 'Starting Ollama',
  model: 'Downloading the AI model'
};

function addBubble(kind, text) {
  const log = $('chat-log');
  const b = el('div', 'bubble ' + kind, text);
  log.append(b);
  log.scrollTop = log.scrollHeight;
  return b;
}

function setupText() {
  if (!aiInfo.supported) return 'The AI assistant only works on Windows for now.';
  if (!aiInfo.installed && !aiInfo.running) return 'The assistant needs Ollama, a free program that runs AI on your own PC. It is not installed yet.';
  if (!aiInfo.running) return 'Ollama is installed but not running.';
  return 'Ollama is running but has no AI model yet.';
}

// Asks the main process what is installed and updates the AI center
async function refreshAI() {
  aiInfo = await window.pc.aiStatus();
  const models = aiInfo.models;
  const saved = data.settings.aiModel;
  aiModel = (models.includes(saved) && saved) || (models.includes(aiInfo.suggested.name) && aiInfo.suggested.name) || models[0] || '';
  aiReady = aiInfo.running && !!aiModel;

  const picker = $('ai-model');
  picker.innerHTML = '';
  models.forEach(m => { const o = el('option', '', m); o.value = m; picker.append(o); });
  picker.value = aiModel;
  picker.style.display = models.length > 1 ? '' : 'none';

  $('ai-state').textContent = aiReady ? 'Ready' : aiInfo.running ? 'No model yet' : aiInfo.installed ? 'Not running' : 'Not set up';
  $('ai-setup').style.display = aiReady ? 'none' : 'block';
  $('ai-setup-text').textContent = setupText();
  $('ai-setup-btn').style.display = aiInfo.supported ? '' : 'none';
  $('chat-in').disabled = !aiReady;
  $('chat-send').disabled = !aiReady;

  if (aiReady && !$('chat-log').children.length) {
    addBubble('ai', 'Hi! I can add tasks and events, change them, and help organize your list. Try: "add a high priority task to call the bank on Friday at 3pm".');
  }
}

// ---------- The permission popup (shown only the first time the AI center is opened) ----------
function closeAIModal() { $('ai-modal').hidden = true; }

function setModalButtons(yesText, onYes, noText, onNo) {
  const yes = $('ai-yes'), no = $('ai-no');
  yes.textContent = yesText;
  yes.onclick = onYes;
  no.hidden = !noText;
  if (noText) { no.textContent = noText; no.onclick = onNo; }
  $('ai-modal-btns').hidden = false;
}

function showAIModal() {
  const s = aiInfo.suggested;
  const needsInstall = !aiInfo.installed && !aiInfo.running;

  $('ai-modal-title').textContent = 'Set up the Zaal assistant';
  const body = $('ai-modal-body');
  body.innerHTML = '';
  body.append(el('p', '', "Zaal's assistant runs on your own PC using a free program called Ollama, so nothing you write is sent online."));
  body.append(el('p', '', 'To turn it on, Zaal needs to:'));
  const steps = el('ol');
  if (needsInstall) steps.append(el('li', '', 'Download Ollama from ollama.com (roughly 1 GB) and install it. No administrator rights needed.'));
  else if (!aiInfo.running) steps.append(el('li', '', 'Start Ollama, which is already installed.'));
  steps.append(el('li', '', 'Download a small AI model, ' + s.name + ' (about ' + s.sizeGB + ' GB, picked for your PC\'s ' + aiInfo.ramGB + ' GB of memory).'));
  steps.append(el('li', '', 'Link it to Zaal.'));
  body.append(steps);
  body.append(el('p', 'muted', 'This can take several minutes depending on your internet. Please keep Zaal open. You need about 4 GB of free disk space plus the model.'));
  body.append(el('p', '', 'May Zaal install it and link it?'));

  $('ai-modal-progress').hidden = true;
  setModalButtons('Install and link', () => runSetup(s.name), 'Not now', closeAIModal);
  $('ai-modal').hidden = false;
}

function onAIProgress(p) {
  $('ai-modal-text').textContent = (STEP_NAMES[p.step] || 'Working') + (p.text ? ': ' + p.text : '');
  const bar = $('ai-modal-bar');
  if (p.pct === null || p.pct === undefined) {
    bar.classList.add('busy');
    bar.style.width = '';
  } else {
    bar.classList.remove('busy');
    bar.style.width = Math.min(100, p.pct) + '%';
  }
}

async function runSetup(model) {
  $('ai-modal-title').textContent = 'Setting up...';
  $('ai-modal-btns').hidden = true;
  $('ai-modal-progress').hidden = false;
  onAIProgress({ step: 'download', pct: null, text: 'Starting...' });

  const r = await window.pc.aiSetup(model);
  $('ai-modal-bar').classList.remove('busy');

  if (r.error) {
    $('ai-modal-title').textContent = 'Something went wrong';
    $('ai-modal-text').textContent = r.error + ' If it keeps failing, you can install Ollama yourself from ollama.com/download, then press "Try again" and Zaal will find it.';
    setModalButtons('Try again', () => runSetup(model), 'Close', closeAIModal);
    return;
  }
  data.settings.aiModel = r.model;
  save();
  await refreshAI();
  $('ai-modal-bar').style.width = '100%';
  $('ai-modal-title').textContent = 'All set!';
  $('ai-modal-text').textContent = 'The assistant is installed and linked to Zaal.';
  setModalButtons('Done', closeAIModal, '');
}

// Called every time the AI center page is opened (see showView in core.js)
async function onAIOpen() {
  await refreshAI();
  if (data.settings.aiIntro) return;      // the popup only appears the very first time
  data.settings.aiIntro = true;
  save();
  if (!aiReady && aiInfo.supported) showAIModal();
}

// ---------- Chatting ----------
function showPlan(plan) {
  const card = el('div', 'plan');
  card.append(el('div', 'plan-h', plan.actions.length ? 'Proposed changes' : "I couldn't do that"));

  const checks = [];
  plan.actions.forEach(a => {
    const row = el('label', a.danger ? 'danger' : '');
    const box = el('input');
    box.type = 'checkbox';
    box.checked = true;
    checks.push(box);
    row.append(box, el('span', '', a.label));
    card.append(row);
  });
  plan.skipped.forEach(s => card.append(el('div', 'skipped', s)));

  if (plan.actions.length) {
    const buttons = el('div', 'btnrow');
    const apply = el('button', 'btn md', 'Apply');
    const cancel = el('button', 'btn md ghost', 'Cancel');

    apply.onclick = () => {
      const chosen = plan.actions.filter((a, i) => checks[i].checked);
      card.innerHTML = '';
      card.className = 'bubble ai';
      if (!chosen.length) { card.textContent = 'Nothing applied.'; return; }
      const before = applyActions(chosen);
      const after = JSON.stringify({ tasks: data.tasks, events: data.events });
      card.append(el('div', '', 'Done: ' + chosen.length + ' change' + (chosen.length > 1 ? 's' : '') + ' applied.'));
      const undo = el('button', 'linkbtn', 'Undo');
      undo.onclick = () => {
        const now = JSON.stringify({ tasks: data.tasks, events: data.events });
        if (now !== after && !confirm('You changed things after this. Undo anyway? Those later changes will be lost too.')) return;
        restoreData(before);
        card.textContent = 'Undone.';
      };
      card.append(undo);
    };
    cancel.onclick = () => { card.className = 'bubble ai'; card.textContent = 'Cancelled.'; };

    buttons.append(apply, cancel);
    card.append(buttons);
  }

  $('chat-log').append(card);
  $('chat-log').scrollTop = $('chat-log').scrollHeight;
}

async function sendChat() {
  const text = $('chat-in').value.trim();
  if (!text || chatBusy || !aiReady) return;

  addBubble('user', text);
  $('chat-in').value = '';
  chatBusy = true;
  $('chat-send').disabled = true;
  const thinking = addBubble('ai thinking', 'Thinking...');

  const ctx = aiContext();
  const messages = [{ role: 'system', content: buildSystemPrompt(ctx) }, ...chatHistory.slice(-6), { role: 'user', content: text }];
  const r = await window.pc.aiChat({ model: aiModel, messages, tools: AI_TOOLS });

  thinking.remove();
  chatBusy = false;
  $('chat-send').disabled = !aiReady;
  if (r.error) { addBubble('ai error', 'Sorry, something went wrong: ' + r.error); return; }

  const msg = r.message || {};
  let calls = msg.tool_calls || [];
  let reply = stripThink(msg.content);
  if (!calls.length) {
    const inline = parseInlineToolCall(reply);
    if (inline) { calls = [inline]; reply = ''; }
  }

  chatHistory.push({ role: 'user', content: text });
  if (reply) addBubble('ai', reply);

  if (calls.length) {
    const plan = planActions(calls, ctx);
    showPlan(plan);
    chatHistory.push({ role: 'assistant', content: reply || '(I suggested ' + plan.actions.length + ' change(s))' });
  } else if (reply) {
    chatHistory.push({ role: 'assistant', content: reply });
  } else {
    addBubble('ai', "I didn't understand that. Could you say it a different way?");
  }
  chatHistory = chatHistory.slice(-8);
}

function initAI() {
  window.pc.onAiProgress(onAIProgress);
  $('ai-setup-btn').onclick = async () => { if (!aiInfo) await refreshAI(); showAIModal(); };
  $('chat-send').onclick = sendChat;
  $('chat-in').onkeydown = e => { if (e.key === 'Enter') sendChat(); };
  $('ai-model').onchange = () => {
    aiModel = $('ai-model').value;
    data.settings.aiModel = aiModel;
    save();
  };
}

function startAI() {
  refreshAI(); // quietly checks what is installed; the popup only comes when the AI center is opened
}
