// ============================================================
// STATE
// ============================================================
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
const PERSISTENCE_WINDOW = 12 * 60 * 60 * 1000; // 12 Hours
let botSummary = null;

// ============================================================
// Session Persistence Logic (12-hour duration)
// ============================================================
function saveChatState() {
  try {
    const state = {
      history: chatContext.history,
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
      <iframe src="/view-asset/Akhilesh_DevOps_Platform_Resume.pdf#toolbar=0" style="width: 100%; height: 100%; border: none;"></iframe>
    </div>
    <div class="text-center">
      <a href="/view-asset/Akhilesh_DevOps_Platform_Resume.pdf" target="_blank" class="btn btn-sm btn-primary">Download full PDF</a>
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
        <a href="/view-asset/documents/resume.pdf" target="_blank" class="cta-btn cta-primary">📄 View Resume</a>
        <a href="https://linkedin.com/in/akhilesh-angadi" target="_blank" class="cta-btn cta-secondary">🔗 LinkedIn</a>
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
  setTimeout(() => { container.style.opacity = '1'; body.scrollTop = body.scrollHeight; }, 80);
}

// ============================================================
// LOAD BOT DATA
// ============================================================
async function loadBotData() {
  try {
    const res = await fetch('../data/summary.json');
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

  body.scrollTop = body.scrollHeight;
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
    body.scrollTop = body.scrollHeight;
    return;
  }
  if (side === 'bot' && extra.cardType === 'hire_him') {
    const card = buildHireHimCard(extra);
    const cardBodyEl = card.querySelector('.hire-card-body');
    const fullText = cardBodyEl ? (cardBodyEl.textContent || cardBodyEl.innerText || '') : '';
    if (cardBodyEl) cardBodyEl.textContent = '';
    card.style.opacity = '0';
    body.appendChild(card);
    await new Promise(r => setTimeout(r, 60));
    card.style.transition = 'opacity 0.2s ease';
    card.style.opacity = '1';
    body.scrollTop = body.scrollHeight;
    if (cardBodyEl && fullText) {
      const tokens = fullText.split(/(\s+)/);
      let current = '';
      for (let token of tokens) {
        current += token;
        cardBodyEl.textContent = current;
        body.scrollTop = body.scrollHeight;
        await new Promise(r => setTimeout(r, 40));
      }
    }
    body.scrollTop = body.scrollHeight;
    return card;
  }
  if (side === 'bot' && extra.cardType === 'info') {
    const card = buildInfoCard(extra);
    const cardBodyEl = card.querySelector('.info-card-body');
    const fullText = cardBodyEl ? (cardBodyEl.textContent || cardBodyEl.innerText || '') : '';
    if (cardBodyEl) cardBodyEl.textContent = '';
    card.style.opacity = '0';
    body.appendChild(card);
    await new Promise(r => setTimeout(r, 60));
    card.style.transition = 'opacity 0.2s ease';
    card.style.opacity = '1';
    body.scrollTop = body.scrollHeight;
    if (cardBodyEl && fullText) {
      const tokens = fullText.split(/(\s+)/);
      let current = '';
      for (let token of tokens) {
        current += token;
        cardBodyEl.textContent = current;
        body.scrollTop = body.scrollHeight;
        await new Promise(r => setTimeout(r, 50));
      }
    }
    body.scrollTop = body.scrollHeight;
    return card;
  }
  const msg = document.createElement('div');
  msg.className = `message ${side}-message`;
  
  const contentSpan = document.createElement('span');
  contentSpan.className = 'msg-content';
  msg.appendChild(contentSpan);
  
  body.appendChild(msg);
  body.scrollTop = body.scrollHeight;
  const hasHtml = /<[a-z][\s\S]*>/i.test(text);
  let currentHtml = '';
  if (hasHtml) {
    for (let line of text.split('\n')) {
      currentHtml += line + '\n';
      contentSpan.innerHTML = currentHtml;
      body.scrollTop = body.scrollHeight;
      await new Promise(r => setTimeout(r, 70));
    }
  } else {
    for (let token of text.split(/(\s+)/)) {
      currentHtml += token;
      contentSpan.innerHTML = currentHtml;
      body.scrollTop = body.scrollHeight;
      await new Promise(r => setTimeout(r, 50));
    }
  }
  if (chatContext.debugMode && extra.intent) contentSpan.innerHTML += `<br><span style="font-size:0.63rem;color:#475569">[${extra.intent} d:${chatContext.depth}]</span>`;
  
  if (!extra.skipHistory) {
    chatContext.history.push({ text, type: side, timestamp: Date.now() });
    saveChatState();
  }
  
  body.scrollTop = body.scrollHeight;
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

// ============================================================
// MAIN SEND HANDLER
// ============================================================
async function handleChatSend(overrideText = null) {
  const input = document.getElementById('chatInput');
  const text = overrideText || (input ? input.value.trim() : "");
  if (!text) return;

  // 🛑 STOP BUTTON ACCESSED DURING PROCESSING
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

  // START PROCESSING
  chatContext.isProcessing = true;
  toggleSendButton(true);
  chatContext.abortController = new AbortController();
  const { signal } = chatContext.abortController;

  try {
    addMessage(text, 'user');
    if (input) input.value = '';

    // Add Thinking Indicator
    const body = document.getElementById('chatBody');
    const typingLLM = document.createElement('div');
    typingLLM.className = 'typing-indicator llm-thinking';
    typingLLM.id = 'typingIndicatorLLM';
    typingLLM.innerHTML = `<div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div><span style="font-size:0.75rem;margin-left:8px;color:rgba(255,255,255,0.7)">Thinking...</span>`;
    body.appendChild(typingLLM);
    body.scrollTop = body.scrollHeight;

    const startTime = Date.now();
    try {
      const llmRes = await fetch('/api/chat/llm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: text, history: chatContext.history }),
        signal
      });

      // UX Delay (2-4s)
      const minDelay = 2000 + Math.random() * 2000;
      const elapsed = Date.now() - startTime;
      if (elapsed < minDelay) await new Promise(r => setTimeout(r, minDelay - elapsed));

      typingLLM.remove();
      if (llmRes.ok) {
        const data = await llmRes.json();
        const answer = data.answer || "I'm not sure how to answer that.";
        
        // Execute narrative response rendering
        const botMsg = await streamMessage(answer, 'bot', { 
            intent: data.intent, 
            skipHistory: false // We handle history inside streamMessage now
        });

        // --- RESTORE SMART CHIPS ---
        let chips = data.hints || [];
        if (typeof ChatbotEngine !== 'undefined' && botSummary) {
          const aiChips = ChatbotEngine.generateFollowUpChips ? ChatbotEngine.generateFollowUpChips(chatContext.lastDomain, chatContext.lastIntent, chatContext) : [];
          chips = [...new Set([...chips, ...aiChips])].slice(0, 4);
        }
        if (chips.length > 0) renderQuickReplies(chips, chatContext);

        if (data.updatedContext) {
          chatContext.lastIntent = data.updatedContext.lastIntent;
          chatContext.depth = data.updatedContext.depth;
        }
      }
    } catch (e) {
      if (e.name === 'AbortError') console.log('[CHAT] Aborted');
      else addMessage("Error connecting to brain.", "bot");
    }
  } finally {
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
  body.scrollTop = body.scrollHeight;
}

document.addEventListener('DOMContentLoaded', async () => {
  const toggle = document.getElementById('chatToggle');
  const close = document.getElementById('closeChatBtn');
  const clear = document.getElementById('clearChatBtn');
  const send = document.getElementById('sendChatBtn');
  const input = document.getElementById('chatInput');
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

  // 3. Knowledge Load (Restored)
  await loadBotData();
});
