/**
 * Akhilesh Angadi Portfolio — Chatbot UI Layer
 *
 * Manages all chatbot UI interactions: message rendering, SSE stream handling,
 * session persistence, card upgrades, copy buttons, and engine source badges.
 *
 * Responsibilities:
 *   1. Open/close/maximise the chat window and persist state to localStorage
 *   2. Send queries to /api/chat/llm and consume the SSE stream token by token
 *   3. Upgrade streamed responses to glassmorphic cards for structured intents
 *   4. Render quick-reply chips, engine badges, and copy buttons on bot messages
 *   5. Auto-open the chat with a contextual greeting for ?ref=linkedin visitors
 *
 * Dependencies:
 *   - chatbot-engine.js  — ChatbotEngine global (sanitise, enforceThirdPerson, etc.)
 *   - /api/chat/llm      — SSE stream endpoint (POST)
 *   - /data/summary.json — knowledge base loaded on DOMContentLoaded
 *
 * Usage:
 *   Loaded as <script src="/scripts/chatbot-ui.js"> on every page via footer.ejs.
 *
 * Author: Akhilesh Angadi
 */
// ============================================================
// STATE
// ============================================================
const CHAT_HISTORY_MAX = 50; // cap history to prevent localStorage quota breach

let chatContext = {
  lastIntent: null,
  lastDomain: null,
  depth: 0,
  lastFollowUps: [],
  history: [],
  visited: new Set(),
  userMode: 'casual',
  debugMode: false,
  llmMode: true,
  isProcessing: false,
  abortController: null // 🛑 For ChatGPT-style "Stop"
};
const STORAGE_KEY = 'akhilesh_chat_state';
const ANALYTICS_KEY = 'akhilesh_chat_analytics';
const PERSISTENCE_WINDOW = 12 * 60 * 60 * 1000; // 12 Hours
let botSummary = null;

// Cached DOM elements — populated on DOMContentLoaded, avoids repeated getElementById per message
const _dom = { body: null, input: null, window: null, send: null };

// ============================================================
// Helpers
// ============================================================
function scrollToBottom(el) {
  if (el) el.scrollTop = el.scrollHeight;
}

function _sanitize(html) {
  return (typeof ChatbotEngine !== 'undefined' && typeof ChatbotEngine.sanitize === 'function')
    ? ChatbotEngine.sanitize(html)
    : html;
}

// ============================================================
// Session Persistence Logic (12-hour duration)
// ============================================================
function saveChatState() {
  try {
    const state = {
      history: chatContext.history.slice(-CHAT_HISTORY_MAX), // cap before storing
      lastIntent: chatContext.lastIntent,
      lastDomain: chatContext.lastDomain,
      depth: chatContext.depth,
      userMode: chatContext.userMode,
      timestamp: Date.now()
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) { console.warn('[PERSISTENCE] Save failed', e); }
}

function loadChatState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const state = JSON.parse(raw);

    // Check 12-hour window
    if (Date.now() - state.timestamp > PERSISTENCE_WINDOW) {
      console.log('[PERSISTENCE] Session expired (>12h). Clearing.');
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return state;
  } catch (e) { return null; }
}

function clearChat() {
  localStorage.removeItem(STORAGE_KEY);
  chatContext.history = [];
  chatContext.lastIntent = null;
  chatContext.depth = 0;

  const body = document.getElementById('chatBody');
  if (body) {
    const initialMsg = document.getElementById('initialBotMessage');
    body.innerHTML = '';
    if (initialMsg) body.appendChild(initialMsg);
  }

  // Re-add scroll tracker
  initScrollTracker();

  // Restore default suggestion chips on initialization
  renderInitialChips();
}

function renderInitialChips() {
  const list = [
    { text: "👤 About Akhilesh", intent: "identity" },
    { text: "💼 Experience", intent: "experience_summary" },
    { text: "🛠️ Skills", intent: "skills_summary" },
    { text: "🚀 Projects", intent: "projects_summary" },
    { text: "🎓 Education", intent: "education" },
    { text: "📜 Certifications", intent: "certifications" },
    { text: "🏆 Awards", intent: "awards" },
    { text: "📚 Publications", intent: "publications_summary" },
    { text: "✍️ Recommendations", intent: "recommendations_summary" },
    { text: "🌐 Languages", intent: "languages_summary" },
    { text: "✉️ Contact", intent: "contact" },
    { text: "🎯 Why Hire him?", intent: "why_hire" },
    { text: "📁 Download Resume", intent: "resume_download" },
    { text: "😂 Tell a Joke", intent: "jokes" },
    { text: "🧩 Give a Riddle", intent: "riddles" }
  ];
  renderQuickReplies(list, chatContext, true);
}

// ============================================================
// USER MODE
// ============================================================
function applyUserMode(mode) {
  if (!mode || mode === chatContext.userMode) return;
  chatContext.userMode = mode;
  const badge = document.getElementById('userModeBadge');
  const win = document.getElementById('chatWindow');
  if (!badge) return;
  const cfg = {
    recruiter: { label: '🎯 Recruiter Mode', cls: 'recruiter' },
    explorer: { label: '🔍 Explorer Mode', cls: 'explorer' }
  }[mode];
  if (!cfg) { badge.style.display = 'none'; return; }
  badge.style.display = 'flex';
  badge.className = `user-mode-badge ${cfg.cls}`;
  badge.innerHTML = `<span class="mode-pulse"></span><span>${cfg.label}</span>`;
  if (win) win.dataset.mode = mode;
}

// ============================================================
// CARD RENDERING
// ============================================================
const CARD_META = {
  experience: { icon: '💼', label: 'Professional Experience', color: '#60a5fa' },
  skills: { icon: '⚡', label: 'Technical Skills', color: '#a78bfa' },
  projects: { icon: '🚀', label: 'Key Projects', color: '#34d399' },
  education: { icon: '🎓', label: 'Education', color: '#fbbf24' },
  publications: { icon: '📚', label: 'Research & Publications', color: '#fb923c' },
  recommendations: { icon: '💬', label: 'Recommendations', color: '#4ade80' },
  awards: { icon: '🏆', label: 'Awards & Recognition', color: '#f59e0b' },
  identity: { icon: '👤', label: 'About Akhilesh', color: '#7c3aed' },
  languages: { icon: '🌐', label: 'Languages', color: '#ec4899' },
  contact: { icon: '📬', label: 'Contact Information', color: '#3b82f6' },
  certifications: { icon: '📜', label: 'Certifications', color: '#10b981' }
};

// Intents that get an InfoCard
const CARD_INTENTS = new Set([
  'experience_sap', 'experience_juniper', 'experience_summary',
  'skills_summary', 'skills_devops', 'skills_cloud', 'skills_backend',
  'skills_frontend', 'skills_ai', 'skills_system_design', 'skills_soft_skills',
  'projects_summary', 'projects_iot', 'projects_cicd',
  'education', 'education_bachelors', 'education_masters',
  'certifications', 'certifications_cka', 'languages_summary', 'contact',
  'recommendations_summary', 'publications_summary', 'awards', 'identity', 'why_hire'
]);

function shouldRenderCard(response) {
  if (!response || !response.intent) return false;
  if (response.intent === 'why_hire' || response.intent === 'hire_him') return 'hire_him';
  if (response.intent === 'resume_download') return 'pdf_resume';
  if (CARD_INTENTS.has(response.intent) || response.isDetailed) return 'info';
  return false;
}

function buildPDFCard() {
  const card = document.createElement('div');
  card.className = 'pdf-card mt-2 p-3 rounded shadow-sm border border-primary';
  card.style.backgroundColor = 'rgba(10, 25, 41, 0.9)';
  card.style.color = '#fff';
  card.innerHTML = `
    <div class="d-flex align-items-center mb-2">
      <div class="me-2 text-primary fs-4">📄</div>
      <div class="fw-bold">Resume Preview</div>
    </div>
    <div class="clear-confirm-popover" style="height: 350px; overflow: hidden; border-radius: 4px; background: #333; margin-bottom: 10px;">
      <iframe src="/view-asset/documents/Resume.pdf#toolbar=0" style="width: 100%; height: 100%; border: none;"></iframe>
    </div>
    <div class="text-center">
      <a href="/view-asset/documents/Resume.pdf" target="_blank" rel="noopener noreferrer" class="btn btn-sm btn-primary">Download full PDF</a>
    </div>
  `;
  return card;
}

function buildInfoCard(response) {
  const meta = CARD_META[response.domain] || { icon: '💡', label: 'Information', color: '#60a5fa' };
  const el = document.createElement('div');
  el.className = 'message info-card-message';
  el.innerHTML = `
      <div class="info-card-inner" style="border-left-color:${meta.color}">
        <div class="info-card-header" style="color:${meta.color}">
          <span>${meta.icon}</span><span>${meta.label}</span>
        </div>
        <div class="info-card-body">${response.answer}</div>
      </div>`;
  return el;
}

function buildHireHimCard(response) {
  const cleanAnswer = (response.answer || '')
    .replace(/^Key highlights?:\s*/i, '')
    .replace(/^Regarding why hire[^,]*,\s*/i, '')
    .replace(/^Sure, here is the information:\s*/i, '')
    .trim();

  const el = document.createElement('div');
  el.className = 'hire-him-card';
  el.innerHTML = `
      <div class="hire-card-header">
        <span style="font-size:1.25rem;flex-shrink:0">🎯</span>
        <span class="hire-card-badge">🟢 Open to Opportunities</span>
      </div>
      <div class="hire-card-highlights">
        <a href="/experience" class="highlight-item"><span class="hi-icon">⚡</span><span>6+ Years Experience</span></a>
        <a href="/my-skills" class="highlight-item"><span class="hi-icon">☁️</span><span>Cloud &amp; DevOps Expert</span></a>
        <a href="/certifications" class="highlight-item"><span class="hi-icon">📜</span><span>Cloud Certified</span></a>
        <a href="/recommendations" class="highlight-item"><span class="hi-icon">🤝</span><span>Highly Recommended</span></a>
      </div>
      <div class="hire-card-cta">
        <a href="/view-asset/documents/Resume.pdf" target="_blank" rel="noopener noreferrer" class="cta-btn cta-primary">📄 View Resume</a>
        <a href="https://linkedin.com/in/akhilesh-angadi" target="_blank" rel="noopener noreferrer" class="cta-btn cta-secondary">🔗 LinkedIn</a>
        <a href="/contact-me" class="cta-btn cta-secondary">📬 Contact</a>
      </div>
      <div class="hire-card-body">${cleanAnswer}</div>`;
  return el;
}

// ============================================================
// SMART CHIPS
// ============================================================
const CHIP_POOL = [
  { text: "👤 About Akhilesh", intent: "identity" },
  { text: "💼 Experience", intent: "experience_summary" },
  { text: "🛠️ Skills", intent: "skills_summary" },
  { text: "🚀 Projects", intent: "projects_summary" },
  { text: "🎓 Education", intent: "education" },
  { text: "📜 Certifications", intent: "certifications" },
  { text: "🏆 Awards", intent: "awards" },
  { text: "📚 Publications", intent: "publications_summary" },
  { text: "✍️ Recommendations", intent: "recommendations_summary" },
  { text: "🌐 Languages", intent: "languages_summary" },
  { text: "✉️ Contact", intent: "contact" },
  { text: "🎯 Why Hire him?", intent: "why_hire" },
  { text: "📁 Download Resume", intent: "resume_download" },
  { text: "🏗️ System Design", intent: "skills_system_design" },
  { text: "☁️ Cloud Expertise", intent: "skills_cloud" },
  { text: "🤖 AI & ML", intent: "skills_ai" },
  { text: "📦 DevOps Work", intent: "skills_devops" },
  { text: "🏠 Location", intent: "location" },
  { text: "😂 Tell a Joke", intent: "jokes" },
  { text: "🧩 Give a Riddle", intent: "riddles" }
];

function getSmartChips(list = [], ctx, max = 4) {
  const visited = ctx.visited || new Set();

  const recommended = (list || [])
    .filter(c => c !== null && c !== undefined)
    .map(c => {
      const text = (typeof c === 'object') ? (c.text || c.label) : c;
      const intent = (typeof c === 'object') ? c.intent : null;
      return { text, intent, _pri: (intent && visited.has(intent)) ? 0 : 2 };
    });

  const filler = [...CHIP_POOL]
    .sort(() => Math.random() - 0.5)
    .map(c => ({ ...c, _pri: visited.has(c.intent) ? 0 : 1 }));

  const merged = [...recommended, ...filler];
  const seenTexts = new Set();
  const final = [];

  for (const chip of merged) {
    if (final.length >= max) break;
    if (!seenTexts.has(chip.text)) {
      seenTexts.add(chip.text);
      final.push(chip);
    }
  }
  return final.sort((a, b) => b._pri - a._pri);
}

function renderQuickReplies(list, ctx, showAll) {
  if (!list || list.length === 0) return;
  const body = document.getElementById('chatBody');
  body.querySelectorAll('.quick-replies-container').forEach(el => el.remove());

  const chips = showAll ? list : getSmartChips(list, ctx || chatContext, 4);
  if (chips.length === 0) return;

  const container = document.createElement('div');
  container.className = 'quick-replies-container active mt-2';
  const qrDiv = document.createElement('div');
  qrDiv.className = 'quick-replies';

  chips.forEach(item => {
    const label = (typeof item === 'object') ? (item.text || item.label) : item;
    if (!label) return;
    const btn = document.createElement('button');
    btn.className = 'qr-btn';
    btn.textContent = label;
    btn.onclick = () => {
      if (item.intent) chatContext.visited.add(item.intent);
      document.getElementById('chatInput').value = label;
      handleChatSend();
    };
    qrDiv.appendChild(btn);
  });

  container.appendChild(qrDiv);
  body.appendChild(container);
  setTimeout(() => { container.style.opacity = '1'; scrollToBottom(body); }, 80);
}

// ============================================================
// LOAD BOT DATA
// ============================================================
async function loadBotData() {
  try {
    const res = await fetch('/data/summary.json');
    botSummary = await res.json();
    try {
      const d = JSON.parse(localStorage.getItem(ANALYTICS_KEY) || '{"sessions":0}');
      d.sessions = (d.sessions || 0) + 1;
      localStorage.setItem(ANALYTICS_KEY, JSON.stringify(d));
    } catch (e) { }
  } catch (e) { console.error("Could not load bot data", e); }
}

// ============================================================
// CHAT WINDOW CONTROLS
// ============================================================
function toggleChat() {
  const win = document.getElementById('chatWindow');
  const isOpening = !win.classList.contains('active');
  if (isOpening && typeof UIManager !== 'undefined') UIManager.closeAll('chat');
  win.classList.toggle('active');

  // Ensure we focus the input on open
  if (isOpening) {
    setTimeout(() => {
      document.getElementById('chatInput')?.focus();
    }, 400);
  }
}

function toggleMaximize() {
  const win = document.getElementById('chatWindow');
  win.classList.toggle('maximized');
  const icon = document.getElementById('maximizeChatBtn')?.querySelector('i');
  if (icon) {
    icon.className = win.classList.contains('maximized') ? 'fas fa-compress-alt' : 'fas fa-expand-alt';
  }
}

// ============================================================
// MESSAGE RENDERING
// ============================================================
function addMessage(text, type, roleId = null, skipHistory = false) {
  const body = document.getElementById('chatBody');
  if (!body) return;

  const div = document.createElement('div');
  div.className = `message ${type}-message`;

  const sanitized = text.replace(/<(?!br|span|b|i|strong|em|a|img|svg)[^>]+>/g, '');
  const contentSpan = document.createElement('span');
  contentSpan.className = 'msg-content';
  contentSpan.innerHTML = sanitized;
  div.appendChild(contentSpan);

  if (type === 'user') {
    const editBtn = document.createElement('button');
    editBtn.className = 'edit-msg-btn';
    editBtn.innerHTML = '<i class="fas fa-pencil-alt"></i>';
    editBtn.onclick = () => editMessage(div, sanitized);
    div.appendChild(editBtn);
  }

  body.appendChild(div);

  if (!skipHistory && type !== 'system') {
    chatContext.history.push({ text: sanitized, type, timestamp: Date.now() });
    saveChatState();
  }

  scrollToBottom(body);
  checkScroll();
}

/**
 * ChatGPT-style Message Edit
 */
async function editMessage(messageDiv, oldText) {
  if (chatContext.isProcessing) return;
  
  const originalHTML = messageDiv.innerHTML;
  const contentSpan = messageDiv.querySelector('.msg-content');
  const editBtn = messageDiv.querySelector('.edit-msg-btn');
  
  if (!contentSpan) return;
  
  // Enter Edit Mode
  messageDiv.classList.add('message-edit-mode');
  contentSpan.style.display = 'none';
  if (editBtn) editBtn.style.display = 'none';
  
  const textarea = document.createElement('textarea');
  textarea.className = 'edit-textarea';
  textarea.value = contentSpan.innerText;
  
  const actions = document.createElement('div');
  actions.className = 'edit-actions';
  
  const confirmBtn = document.createElement('button');
  confirmBtn.className = 'edit-action-btn confirm';
  confirmBtn.innerHTML = '<i class="fas fa-check"></i>';
  confirmBtn.title = "Save and re-send";
  
  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'edit-action-btn cancel';
  cancelBtn.innerHTML = '<i class="fas fa-times"></i>';
  cancelBtn.title = "Cancel";
  
  actions.appendChild(cancelBtn);
  actions.appendChild(confirmBtn);
  
  messageDiv.appendChild(textarea);
  messageDiv.appendChild(actions);
  
  textarea.focus();
  textarea.style.height = textarea.scrollHeight + 'px';
  textarea.oninput = () => {
    textarea.style.height = 'auto';
    textarea.style.height = textarea.scrollHeight + 'px';
  };
  
  // Cancel Action
  cancelBtn.onclick = (e) => {
    e.stopPropagation();
    messageDiv.classList.remove('message-edit-mode');
    textarea.remove();
    actions.remove();
    contentSpan.style.display = '';
    if (editBtn) editBtn.style.display = '';
  };
  
  // Confirm Action
  confirmBtn.onclick = async (e) => {
    e.stopPropagation();
    const currentText = contentSpan.innerText.trim();
    const newText = textarea.value.trim();
    
    if (!newText || newText === currentText) {
      cancelBtn.onclick(e);
      return;
    }
    
    // 1. Truncate History
    // Search for the current text in history
    const historyIndex = chatContext.history.findIndex(h => h.text === currentText);
    if (historyIndex !== -1) {
      chatContext.history = chatContext.history.slice(0, historyIndex);
      // Remove subsequent UI elements
      while (messageDiv.nextSibling) {
        messageDiv.nextSibling.remove();
      }
      messageDiv.remove();
      
      // 2. Re-send
      handleChatSend(newText);
    }
  };
}

/**
 * Scroll Tracker
 */
function initScrollTracker() {
  const body = document.getElementById('chatBody');
  const btn = document.getElementById('scrollToBottomBtn');
  if (!body || !btn) return;

  body.onscroll = () => checkScroll();
  btn.onclick = () => {
    body.scrollTo({ top: body.scrollHeight, behavior: 'smooth' });
  };
}

function checkScroll() {
  const body = document.getElementById('chatBody');
  const btn = document.getElementById('scrollToBottomBtn');
  if (!body || !btn) return;

  const isAtBottom = body.scrollHeight - body.scrollTop - body.clientHeight < 100;
  if (isAtBottom) {
    btn.classList.remove('visible');
  } else {
    btn.classList.add('visible');
  }
}

async function streamMessage(text, side, extra = {}) {
  const body = document.getElementById('chatBody');
  if (side === 'bot' && extra.cardType === 'pdf_resume') {
    const card = buildPDFCard();
    body.appendChild(card);
    scrollToBottom(body);
    return;
  }
  if (side === 'bot' && extra.cardType === 'hire_him') {
    const card = buildHireHimCard(extra);
    const cardBodyEl = card.querySelector('.hire-card-body');
    const fullHtml = cardBodyEl ? (cardBodyEl.innerHTML || '') : '';
    if (cardBodyEl) cardBodyEl.innerHTML = '';
    card.style.opacity = '0';
    body.appendChild(card);
    await new Promise(r => setTimeout(r, 60));
    card.style.transition = 'opacity 0.2s ease';
    card.style.opacity = '1';
    scrollToBottom(body);
    if (cardBodyEl && fullHtml) {
      const tokens = fullHtml.split(/(\s+)/);
      let current = '';
      for (let token of tokens) {
        current += token;
        cardBodyEl.innerHTML = _sanitize(current);
        scrollToBottom(body);
        await new Promise(r => setTimeout(r, 40));
      }
    }
    scrollToBottom(body);
    return card;
  }
  if (side === 'bot' && extra.cardType === 'info') {
    const card = buildInfoCard(extra);
    const cardBodyEl = card.querySelector('.info-card-body');
    const fullHtml = cardBodyEl ? (cardBodyEl.innerHTML || '') : '';
    if (cardBodyEl) cardBodyEl.innerHTML = '';
    card.style.opacity = '0';
    body.appendChild(card);
    await new Promise(r => setTimeout(r, 60));
    card.style.transition = 'opacity 0.2s ease';
    card.style.opacity = '1';
    scrollToBottom(body);
    if (cardBodyEl && fullHtml) {
      const tokens = fullHtml.split(/(\s+)/);
      let current = '';
      for (let token of tokens) {
        current += token;
        cardBodyEl.innerHTML = _sanitize(current);
        scrollToBottom(body);
        await new Promise(r => setTimeout(r, 50));
      }
    }
    scrollToBottom(body);
    return card;
  }
  const msg = document.createElement('div');
  msg.className = `message ${side}-message`;

  const contentSpan = document.createElement('span');
  contentSpan.className = 'msg-content';
  msg.appendChild(contentSpan);

  if (side === 'bot') {
    const copyBtn = document.createElement('button');
    copyBtn.className = 'copy-btn';
    copyBtn.title = 'Copy message';
    copyBtn.innerHTML = '<i class="far fa-copy"></i>';
    copyBtn.onclick = () => {
      const textToCopy = contentSpan.textContent || '';
      navigator.clipboard.writeText(textToCopy).then(() => {
        copyBtn.innerHTML = '<i class="fas fa-check"></i>';
        copyBtn.classList.add('copied');
        setTimeout(() => {
          copyBtn.innerHTML = '<i class="far fa-copy"></i>';
          copyBtn.classList.remove('copied');
        }, 1500);
      }).catch(() => {});
    };
    msg.appendChild(copyBtn);
  }
  
  body.appendChild(msg);
  scrollToBottom(body);
  const hasHtml = /<[a-z][\s\S]*>/i.test(text);
  let currentHtml = '';
  if (hasHtml) {
    for (let line of text.split('\n')) {
      currentHtml += line + '\n';
      contentSpan.innerHTML = _sanitize(currentHtml);
      scrollToBottom(body);
      await new Promise(r => setTimeout(r, 70));
    }
  } else {
    for (let token of text.split(/(\s+)/)) {
      currentHtml += token;
      contentSpan.innerHTML = _sanitize(currentHtml);
      scrollToBottom(body);
      await new Promise(r => setTimeout(r, 50));
    }
  }
  if (chatContext.debugMode && extra.intent) contentSpan.innerHTML += `<br><span style="font-size:0.63rem;color:#475569">[${extra.intent} d:${chatContext.depth}]</span>`;
  
  if (!extra.skipHistory) {
    chatContext.history.push({ text, type: side, timestamp: Date.now() });
    saveChatState();
  }
  
  scrollToBottom(body);
  return msg;
}

// ============================================================
// RESPONSE RESOLUTION
// ============================================================
function findResponse(query) {
  if (!botSummary || typeof ChatbotEngine === 'undefined') return { answer: "Bot is still loading…", isFallback: true };
  const result = ChatbotEngine.findResponse(query, botSummary, chatContext);
  if (result.answer && typeof ChatbotEngine.sanitize === 'function') result.answer = ChatbotEngine.sanitize(result.answer);
  if (result.updatedContext) {
    chatContext = { ...chatContext, ...result.updatedContext };
    if (result.intent) chatContext.visited.add(result.intent);
    if (result.intent) chatContext.lastIntent = result.intent;
    if (result.domain) chatContext.lastDomain = result.domain;
  }
  return result;
}

function appendEngineBadge(messageEl, engine) {
  if (!messageEl || !engine) return;
  const cfg = {
    deterministic: { icon: '⚡', label: 'Instant', cls: 'badge-instant' },
    online:        { icon: '🤖', label: 'AI',      cls: 'badge-ai'      },
    offline:       { icon: '💾', label: 'Local AI', cls: 'badge-local'   }
  }[engine];
  if (!cfg) return;
  const badge = document.createElement('span');
  badge.className = `engine-badge ${cfg.cls}`;
  badge.innerHTML = `${cfg.icon} ${cfg.label}`;
  messageEl.appendChild(badge);
}

// ============================================================
// MAIN SEND HANDLER (SSE streaming)
// ============================================================
async function handleChatSend(overrideText = null) {
  const input = document.getElementById('chatInput');
  const text = overrideText || (input ? input.value.trim() : "");
  if (!text) return;

  // Stop if already processing
  if (chatContext.isProcessing) {
    if (chatContext.abortController) {
      chatContext.abortController.abort();
      chatContext.isProcessing = false;
      document.getElementById('typingIndicatorLLM')?.remove();
      toggleSendButton(false);
      addMessage("⚠️ Generation stopped by user.", "system");
    }
    return;
  }

  // COMMAND-LINE BYPASS (/debug, /ai)
  if (text.startsWith('/') && !overrideText) {
    if (text === '/debug') {
      chatContext.debugMode = !chatContext.debugMode;
      addMessage(`Debug mode ${chatContext.debugMode ? 'ON 🔍' : 'OFF'}`, 'bot');
      input.value = ''; return;
    }
  }

  chatContext.isProcessing = true;
  toggleSendButton(true);
  chatContext.abortController = new AbortController();
  const { signal } = chatContext.abortController;

  try {
    addMessage(text, 'user');
    if (input) input.value = '';

    const body = document.getElementById('chatBody');
    const typingLLM = document.createElement('div');
    typingLLM.className = 'typing-indicator llm-thinking';
    typingLLM.id = 'typingIndicatorLLM';
    typingLLM.innerHTML = `<div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div><span style="font-size:0.75rem;margin-left:8px;color:rgba(255,255,255,0.7)">Thinking...</span>`;
    body.appendChild(typingLLM);
    scrollToBottom(body);

    try {
      const response = await fetch('/api/chat/llm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: text, history: chatContext.history }),
        signal
      });

      if (!response.ok || !response.body) {
        typingLLM.remove();
        // Try to surface a meaningful error (e.g. rate-limit message) before falling back to generic
        let errorMsg = "Error connecting to brain.";
        try {
          const errData = await response.clone().json();
          if (errData && errData.error) errorMsg = errData.error;
        } catch (_) {}
        if (response.status === 429) errorMsg = "Too many messages — please wait a moment before trying again.";
        addMessage(errorMsg, "bot");
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let streamMsgEl = null;
      let streamContentEl = null;
      let fullStreamAnswer = '';
      let donePayload = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop(); // keep incomplete line

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const raw = line.slice(6).trim();
          if (!raw) continue;

          let event;
          try { event = JSON.parse(raw); } catch { continue; }

          if (event.type === 'token') {
            // First token: remove thinking indicator, create streaming bubble
            if (!streamMsgEl) {
              typingLLM.remove();
              streamMsgEl = document.createElement('div');
              streamMsgEl.className = 'message bot-message';
              streamContentEl = document.createElement('span');
              streamContentEl.className = 'msg-content';
              streamMsgEl.appendChild(streamContentEl);
              body.appendChild(streamMsgEl);
            }
            fullStreamAnswer += event.content;
            if (streamContentEl) {
              streamContentEl.innerHTML = _sanitize(fullStreamAnswer);
            }
            scrollToBottom(body);

          } else if (event.type === 'answer') {
            // Deterministic fast-path or offline fallback: got full answer at once
            typingLLM.remove();
            donePayload = event;
            const cardType = shouldRenderCard(event);
            if (cardType) {
              await streamMessage(event.answer, 'bot', { ...event, cardType, skipHistory: true });
            } else {
              await streamMessage(event.answer, 'bot', { intent: event.intent, engine: event.engine, skipHistory: true });
            }

          } else if (event.type === 'done') {
            donePayload = donePayload || event;

            // Finalize streamed content
            if (streamMsgEl && streamContentEl && fullStreamAnswer) {
              // Strip any suggestion suffix the model appended inside the stream
              let cleanAnswer = fullStreamAnswer;
              const suggestionMatch = cleanAnswer.match(/(?:\[?SUGGESTIONS\]?|Suggestions:|Follow-up questions:|Ask me about:)\s*(.*)/is);
              if (suggestionMatch) cleanAnswer = cleanAnswer.split(suggestionMatch[0])[0].trim();

              const cardType = shouldRenderCard(event);
              if (cardType) {
                // Upgrade plain streaming bubble to a glassmorphic card
                streamMsgEl.remove();
                await streamMessage(cleanAnswer, 'bot', { ...event, cardType, skipHistory: true });
                chatContext.history.push({ text: cleanAnswer, type: 'bot', timestamp: Date.now() });
                saveChatState();
              } else {
                const sanitized = typeof ChatbotEngine !== 'undefined'
                  ? ChatbotEngine.sanitize(cleanAnswer)
                  : cleanAnswer;
                const enforced = typeof ChatbotEngine !== 'undefined'
                  ? ChatbotEngine.enforceThirdPerson(sanitized, event.intent, '')
                  : sanitized;
                streamContentEl.innerHTML = enforced;
                appendEngineBadge(streamMsgEl, event.engine);
                chatContext.history.push({ text: enforced, type: 'bot', timestamp: Date.now() });
                saveChatState();
              }
            } else if (donePayload && donePayload.type === 'answer') {
              // Badge for the deterministic/offline message rendered above
              const lastBotMsg = body.querySelector('.bot-message:last-of-type');
              if (lastBotMsg && !lastBotMsg.querySelector('.engine-badge')) {
                appendEngineBadge(lastBotMsg, event.engine);
              }
              // Save to history so Gemini has context on follow-up turns
              if (donePayload.answer) {
                chatContext.history.push({ text: donePayload.answer, type: 'bot', timestamp: Date.now() });
                saveChatState();
              }
            }

            // Render chips
            let chips = event.hints || [];
            if (typeof ChatbotEngine !== 'undefined' && botSummary) {
              const aiChips = ChatbotEngine.generateFollowUpChips
                ? ChatbotEngine.generateFollowUpChips(chatContext.lastDomain, chatContext.lastIntent, chatContext)
                : [];
              chips = [...new Set([...chips, ...aiChips])].slice(0, 4);
            }
            if (chips.length > 0) renderQuickReplies(chips, chatContext);

            if (event.intent) {
              chatContext.lastIntent = event.intent;
              chatContext.visited.add(event.intent);
            }

            if (chatContext.debugMode && event.intent) {
              const dbg = document.createElement('span');
              dbg.style.cssText = 'font-size:0.63rem;color:#475569;display:block;margin-top:4px';
              dbg.textContent = `[${event.intent} · ${event.engine}]`;
              (streamMsgEl || body.querySelector('.bot-message:last-of-type'))?.appendChild(dbg);
            }
          }
        }
      }
    } catch (e) {
      if (e.name === 'AbortError') console.log('[CHAT] Aborted by user');
      else { document.getElementById('typingIndicatorLLM')?.remove(); addMessage("Error connecting to brain.", "bot"); }
    }
  } finally {
    if (typeof reader !== 'undefined' && reader) reader.cancel().catch(() => {});
    chatContext.isProcessing = false;
    chatContext.abortController = null;
    toggleSendButton(false);
    saveChatState();
  }
}

function toggleSendButton(isProcessing) {
  const btn = document.getElementById('sendChatBtn');
  if (!btn) return;
  const sendIcon = btn.querySelector('.send-icon');
  const stopIcon = btn.querySelector('.stop-icon');

  if (isProcessing) {
    if (sendIcon) sendIcon.style.display = 'none';
    if (stopIcon) stopIcon.style.display = 'block';
  } else {
    if (sendIcon) sendIcon.style.display = 'block';
    if (stopIcon) stopIcon.style.display = 'none';
  }
}

function renderTracePanel(trace) {
  const body = document.getElementById('chatBody');
  const panel = document.createElement('div');
  panel.className = 'trace-panel active mt-2 p-3 rounded shadow-sm border border-secondary';
  panel.style.backgroundColor = 'rgba(20, 20, 30, 0.95)';
  panel.style.color = '#00ffcc';
  panel.style.fontFamily = 'monospace';
  panel.style.fontSize = '11px';
  panel.innerHTML = `
    <div class="fw-bold mb-2 border-bottom border-secondary pb-1">🔍 DIAGNOSTIC TRACE</div>
    <div><b>Query:</b> "${trace.query}"</div>
    <div><b>Intent:</b> ${trace.intent}</div>
    <div><b>Path:</b> ${trace.path}</div>
  `;
  body.appendChild(panel);
  scrollToBottom(body);
}

document.addEventListener('DOMContentLoaded', async () => {
  // Cache frequently-used DOM elements once — avoids repeated getElementById per message
  _dom.body   = document.getElementById('chatBody');
  _dom.input  = document.getElementById('chatInput');
  _dom.window = document.getElementById('chatWindow');
  _dom.send   = document.getElementById('sendChatBtn');

  const toggle = document.getElementById('chatToggle');
  const close = document.getElementById('closeChatBtn');
  const clear = document.getElementById('clearChatBtn');
  const send = _dom.send;
  const input = _dom.input;
  const maximize = document.getElementById('maximizeChatBtn');

  // Hydration
  const savedState = loadChatState();
  if (savedState) {
    chatContext.history = [];
    chatContext.lastIntent = savedState.lastIntent;
    chatContext.lastDomain = savedState.lastDomain;
    chatContext.depth = savedState.depth;
    chatContext.userMode = savedState.userMode || 'casual';
    savedState.history.forEach(msg => {
      // Re-render without adding to new history (skipHistory=true)
      addMessage(msg.text, msg.type, null, true);
    });
  } else {
    // 🛑 INITIAL CHIPS IF NO HISTORY
    renderInitialChips();
  }

  initScrollTracker();

  if (toggle) toggle.onclick = toggleChat;
  if (close) close.onclick = toggleChat;
  if (maximize) maximize.onclick = toggleMaximize;

  // --- MODERN CLEAR CONFIRMATION ---
  const popover = document.getElementById('clearConfirmPopover');
  const confirmBtn = document.getElementById('confirmClearBtn');

  if (clear && popover) {
    clear.onclick = (e) => {
      e.stopPropagation();
      popover.classList.toggle('active');
    };
    // Close popover if clicking outside
    document.addEventListener('click', () => popover.classList.remove('active'));
    popover.onclick = (e) => e.stopPropagation();
  }

  if (confirmBtn) {
    confirmBtn.onclick = () => {
      clearChat();
      popover.classList.remove('active');
    };
  }

  if (send) send.onclick = () => handleChatSend();
  if (input) {
    input.onkeypress = (e) => {
      if (e.key === 'Enter') handleChatSend();
    };
  }

  // 3. Knowledge Load
  await loadBotData();

  // LinkedIn referral: auto-open chatbot and send contextual greeting
  const refSource = new URLSearchParams(window.location.search).get('ref');
  if (refSource === 'linkedin') {
    setTimeout(() => {
      const win = document.getElementById('chatWindow');
      if (win && !win.classList.contains('active')) {
        toggleChat();
        setTimeout(() => streamMessage(
          "👋 Welcome! Looks like you came from LinkedIn. I'm Akhilesh's portfolio AI — ask me about his experience, skills, or availability for new roles.",
          'bot',
          { skipHistory: true }
        ), 800);
      }
    }, 1500);
  }
});
