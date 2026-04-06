// ============================================================
// STATE
// ============================================================
let chatContext = {
  lastIntent: null,
  lastDomain: null,
  depth: 0,
  lastFollowUps: [],
  history: [],
  visited: new Set(),      // track visited intents for smart chip filtering
  userMode: 'casual',      // 'casual' | 'recruiter' | 'explorer'
  debugMode: false
};
let botSummary = null;

// ============================================================
// ANALYTICS  (localStorage, silent fail)
// ============================================================
const ANALYTICS_KEY = 'akhilesh_ai_analytics';

function trackAnalytics(intent, domain, rawQuery) {
  try {
    const data = JSON.parse(localStorage.getItem(ANALYTICS_KEY) ||
      '{"sessions":0,"totalQueries":0,"intents":{},"unknowns":[],"recruiterSignals":0}');
    data.totalQueries = (data.totalQueries || 0) + 1;
    data.lastSeen = new Date().toISOString();
    if (!intent || intent === 'unknown') {
      data.unknowns = (data.unknowns || []).slice(-30);
      data.unknowns.push((rawQuery || '').slice(0, 80));
    } else {
      data.intents[intent] = (data.intents[intent] || 0) + 1;
    }
    if (chatContext.userMode === 'recruiter') data.recruiterSignals = (data.recruiterSignals || 0) + 1;
    localStorage.setItem(ANALYTICS_KEY, JSON.stringify(data));
  } catch (e) { /* silent */ }
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
  if (response.intent === 'why_hire') return 'hire_him';
  if (CARD_INTENTS.has(response.intent)) return 'info';
  return false;
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
  // Strip any variation-template prefix that may have leaked (e.g. "Key highlights:")
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
        <span class="hire-card-title">Why Hire Akhilesh?</span>
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
function getSmartChips(list, ctx, max) {
  if (!list || list.length === 0) return [];
  const visited = ctx.visited || new Set();
  const scored = list
    .filter(c => c && c.text)
    .map(c => ({ ...c, _pri: visited.has(c.intent) ? 0 : 1 }))
    .sort((a, b) => b._pri - a._pri);
  return scored.slice(0, max || 4);
}

// ============================================================
// QUICK REPLIES
// ============================================================
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
    const label = (typeof item === 'object') ? item.text : item;
    const btn = document.createElement('button');
    btn.className = 'qr-btn';
    btn.textContent = label;
    btn.onclick = () => {
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
    // Increment session count in analytics
    try {
      const d = JSON.parse(localStorage.getItem(ANALYTICS_KEY) || '{"sessions":0}');
      d.sessions = (d.sessions || 0) + 1;
      localStorage.setItem(ANALYTICS_KEY, JSON.stringify(d));
    } catch (e) { }
    // Show all initial domain chips (showAll = true)
    renderQuickReplies([
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
      { text: "🎯 Why Hire Akhilesh?", intent: "why_hire" }
    ], {}, true);
  } catch (e) { console.error("Could not load bot data", e); }
}
loadBotData();

// ============================================================
// CHAT WINDOW CONTROLS
// ============================================================
function toggleChat() {
  const win = document.getElementById('chatWindow');
  const isOpening = !win.classList.contains('active');
  if (isOpening && typeof UIManager !== 'undefined') UIManager.closeAll('chat');
  win.classList.toggle('active');
}
function toggleMaximize() {
  document.getElementById('chatWindow').classList.toggle('maximized');
}

// ============================================================
// MESSAGE RENDERING
// ============================================================
function addMessage(text, side, extra = {}) {
  const body = document.getElementById('chatBody');
  const msg = document.createElement('div');
  msg.className = `message ${side}-message`;
  let content = text;
  if (chatContext.debugMode && extra.intent)
    content += `<br><span style="font-size:0.63rem;color:#475569">[${extra.intent} d:${extra.depth || 0}]</span>`;
  msg.innerHTML = content;
  body.appendChild(msg);
  body.scrollTop = body.scrollHeight;
  return msg;
}

async function streamMessage(text, side, extra = {}) {
  const body = document.getElementById('chatBody');

  // Card dispatch for Hire Him
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

  // Info Card dispatch
  if (side === 'bot' && extra.cardType === 'info') {
    // Build card structure, then STREAM text into card body (Copilot-like feel)
    const card = buildInfoCard(extra);
    const cardBodyEl = card.querySelector('.info-card-body');
    const fullText = cardBodyEl ? (cardBodyEl.textContent || cardBodyEl.innerText || '') : '';
    if (cardBodyEl) cardBodyEl.textContent = ''; // clear; will stream in
    card.style.opacity = '0';
    body.appendChild(card);
    // Fade card in first, then stream the text
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

  // Plain text streaming
  const msg = document.createElement('div');
  msg.className = `message ${side}-message`;
  body.appendChild(msg);
  body.scrollTop = body.scrollHeight;

  const hasHtml = /<[a-z][\s\S]*>/i.test(text);
  let currentHtml = '';
  if (hasHtml) {
    for (let line of text.split('\n')) {
      currentHtml += line + '\n';
      msg.innerHTML = currentHtml;
      body.scrollTop = body.scrollHeight;
      await new Promise(r => setTimeout(r, 70));
    }
  } else {
    for (let token of text.split(/(\s+)/)) {
      currentHtml += token;
      msg.innerHTML = currentHtml;
      body.scrollTop = body.scrollHeight;
      await new Promise(r => setTimeout(r, 50));
    }
  }

  if (chatContext.debugMode && extra.intent)
    msg.innerHTML += `<br><span style="font-size:0.63rem;color:#475569">[${extra.intent} d:${chatContext.depth}]</span>`;

  body.scrollTop = body.scrollHeight;
  return msg;
}

// ============================================================
// RESPONSE RESOLUTION
// ============================================================
function findResponse(query) {
  if (!botSummary || typeof ChatbotEngine === 'undefined')
    return { answer: "Bot is still loading…", isFallback: true };

  const result = ChatbotEngine.findResponse(query, botSummary, chatContext);
  if (result.updatedContext) {
    chatContext = { ...chatContext, ...result.updatedContext };
    // Preserve non-serializable state
    if (!(chatContext.visited instanceof Set)) chatContext.visited = new Set();
    if (result.intent) chatContext.visited.add(result.intent);
    chatContext.history = chatContext.history || [];
    chatContext.history.push(result.intent || 'unknown');
    if (chatContext.history.length > 15) chatContext.history.shift();
  }
  return result;
}

// ============================================================
// MAIN SEND HANDLER
// ============================================================
async function handleChatSend() {
  const input = document.getElementById('chatInput');
  const text = input.value.trim();
  if (!text) return;

  // Hidden developer commands
  if (text === '/debug') {
    chatContext.debugMode = !chatContext.debugMode;
    addMessage(`Debug mode ${chatContext.debugMode ? 'ON 🔍' : 'OFF'}`, 'bot');
    input.value = '';
    return;
  }
  if (text === '/analytics') {
    try {
      const d = JSON.parse(localStorage.getItem(ANALYTICS_KEY) || '{}');
      const top = Object.entries(d.intents || {})
        .sort((a, b) => b[1] - a[1]).slice(0, 5)
        .map(([k, v]) => `  ${k}: ${v}`).join('\n') || '  (none yet)';
      addMessage(`📊 Session Analytics\nTotal Queries: ${d.totalQueries || 0}\nSessions: ${d.sessions || 0}\nRecruiter Signals: ${d.recruiterSignals || 0}\nTop Intents:\n${top}`, 'bot');
    } catch (e) { addMessage('No analytics data yet.', 'bot'); }
    input.value = '';
    return;
  }

  // Detect and apply user mode on every message
  if (typeof ChatbotEngine.detectUserMode === 'function') {
    const detectedMode = ChatbotEngine.detectUserMode(text);
    if (detectedMode) applyUserMode(detectedMode);
  }

  // Check for multi-intent (show advisory banner, still resolve the best single intent)
  let multiIntents = null;
  if (typeof ChatbotEngine.detectMultiIntent === 'function' && botSummary) {
    multiIntents = ChatbotEngine.detectMultiIntent(text, botSummary);
  }

  addMessage(text, 'user');
  input.value = '';

  // CRITICAL: Clear initial domain nav chips (and any leftover chips) before typing indicator
  // Without this, the chip grid blocks the card and scroll can't reach it
  const body = document.getElementById('chatBody');
  body.querySelectorAll('.quick-replies-container').forEach(el => el.remove());

  // Typing indicator
  const typing = document.createElement('div');
  typing.className = 'typing-indicator';
  typing.id = 'typingIndicator';
  typing.innerHTML = '<div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div>';
  body.appendChild(typing);
  body.scrollTop = body.scrollHeight;

  // Slightly faster in recruiter mode
  const baseDelay = chatContext.userMode === 'recruiter' ? 380 : 580;
  await new Promise(r => setTimeout(r, baseDelay + Math.random() * 250));
  document.getElementById('typingIndicator')?.remove();

  // Resolve response
  const response = findResponse(text);

  // Track analytics
  trackAnalytics(response.intent, response.domain, text);

  // If multi-intent detected, show informational banner first
  if (multiIntents && multiIntents.length === 2) {
    const banner = document.createElement('div');
    banner.className = 'multi-intent-banner';
    banner.textContent = `🔀 Multiple topics detected — showing the best match first. Ask separately for more detail on each.`;
    body.appendChild(banner);
    body.scrollTop = body.scrollHeight;
  }

  // Render response (card or plain)
  const cardType = shouldRenderCard(response);
  await streamMessage(response.answer, 'bot', { ...response, cardType, depth: chatContext.depth });

  // Smart chips — max 4, filter visited
  // Suppress chips for hire_him card (CTAs are already in the card)
  if (cardType !== 'hire_him') {
    const chips = (response.follow_up && response.follow_up.length > 0)
      ? response.follow_up
      : (response.suggestions || []);
    if (chips.length > 0) renderQuickReplies(chips, chatContext, false);
  }
}

// ============================================================
// EVENT LISTENERS
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('chatToggle').addEventListener('click', toggleChat);
  document.getElementById('closeChatBtn').addEventListener('click', toggleChat);
  document.getElementById('maximizeChatBtn').addEventListener('click', toggleMaximize);
  document.getElementById('sendChatBtn').addEventListener('click', handleChatSend);
  document.getElementById('chatInput').addEventListener('keypress', e => { if (e.key === 'Enter') handleChatSend(); });
});
