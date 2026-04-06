/**
 * Command Palette (Staff+ v1)
 * Ctrl+K / Cmd+K Global Search & Action System
 */
const CommandPalette = {
  active: false,
  commands: [
    { id: 'nav-home', label: 'Go to Home', icon: 'fa-home', action: () => window.location.href = '/' },
    { id: 'nav-exp', label: 'View Experience', icon: 'fa-briefcase', action: () => window.location.href = '/experience' },
    { id: 'nav-skills', label: 'Technical Skills', icon: 'fa-bolt', action: () => window.location.href = '/my-skills' },
    { id: 'nav-projects', label: 'Key Projects', icon: 'fa-rocket', action: () => window.location.href = '/my-works' },
    { id: 'nav-certs', label: 'Certifications', icon: 'fa-certificate', action: () => window.location.href = '/certifications' },
    { id: 'nav-contact', label: 'Contact Akhilesh', icon: 'fa-paper-plane', action: () => window.location.href = '/contact-me' },
    { id: 'action-feedback', label: 'Give Feedback (Popup)', icon: 'fa-comment-alt', action: () => { if (typeof showFeedbackPopup === 'function') showFeedbackPopup(); CommandPalette.close(); } },
    { id: 'action-theme', label: 'Toggle Dark/Light Mode', icon: 'fa-adjust', action: () => document.getElementById('theme-toggle')?.click() },
    { id: 'bot-hire', label: 'Why Hire Him? (Recruiter Mode)', icon: 'fa-bullseye', action: () => CommandPalette.triggerChat('Why hire him?') }
  ],
  selectedIndex: 0,
  filteredCommands: [],

  init() {
    this.createEl();
    this.bindEvents();
    this.loadBotCommands();
  },

  async loadBotCommands() {
    try {
      const res = await fetch('/data/summary.json');
      const data = await res.json();
      if (data && data.mappings) {
        // Add top 5 intents to palette
        const botCmds = data.mappings
          .filter(m => ['experience_summary', 'skills_summary', 'projects_summary', 'certifications', 'contact'].includes(m.intent))
          .map(m => ({
            id: `bot-${m.intent}`,
            label: `Ask Bot: ${m.intent.replace('_summary', '').replace('_', ' ')}`,
            icon: 'fa-robot',
            action: () => this.triggerChat(m.intent.replace('_', ' '))
          }));
        this.commands = [...this.commands, ...botCmds];
      }
    } catch (e) { console.error("Palette data load failed", e); }
  },

  triggerChat(query) {
    if (typeof toggleChat === 'function') {
      const win = document.getElementById('chatWindow');
      if (!win.classList.contains('active')) toggleChat();
      const input = document.getElementById('chatInput');
      if (input) {
        input.value = query;
        if (typeof handleChatSend === 'function') handleChatSend();
      }
    }
    this.close();
  },

  createEl() {
    const html = `
      <div id="cmdPaletteBackdrop" class="cmd-palette-backdrop">
        <div class="cmd-palette">
          <div class="cmd-input-container">
            <i class="fas fa-search"></i>
            <input type="text" id="cmdInput" placeholder="Type a command or search..." autocomplete="off">
          </div>
          <div id="cmdResults" class="cmd-results"></div>
          <div class="cmd-footer">
            <span><span class="cmd-key">↑↓</span> to navigate</span>
            <span><span class="cmd-key">Enter</span> to select</span>
            <span><span class="cmd-key">Esc</span> to close</span>
          </div>
        </div>
      </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
    this.backdrop = document.getElementById('cmdPaletteBackdrop');
    this.input = document.getElementById('cmdInput');
    this.results = document.getElementById('cmdResults');
  },

  bindEvents() {
    window.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        this.toggle();
      }
      if (e.key === 'Escape' && this.active) this.close();
    });

    this.backdrop.addEventListener('click', (e) => {
      if (e.target === this.backdrop) this.close();
    });

    this.input.addEventListener('input', () => this.search());
    this.results.addEventListener('click', (e) => {
      const item = e.target.closest('.cmd-item');
      if (item) {
        const index = parseInt(item.dataset.index);
        this.execute(index);
      }
    });
    this.input.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        this.selectedIndex = (this.selectedIndex + 1) % this.filteredCommands.length;
        this.renderResults();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        this.selectedIndex = (this.selectedIndex - 1 + this.filteredCommands.length) % this.filteredCommands.length;
        this.renderResults();
      } else if (e.key === 'Enter') {
        const cmd = this.filteredCommands[this.selectedIndex];
        if (cmd) cmd.action();
      }
    });
  },

  toggle() {
    this.active ? this.close() : this.open();
  },

  open() {
    this.active = true;
    if (typeof UIManager !== 'undefined') UIManager.closeAll('palette');
    this.backdrop.classList.add('active');
    document.body.style.overflow = 'hidden';
    this.input.value = '';
    this.search();
    setTimeout(() => this.input.focus(), 50);
  },

  close() {
    this.active = false;
    this.backdrop.classList.remove('active');
    document.body.style.overflow = '';
    this.input.blur();
  },

  search() {
    const q = this.input.value.toLowerCase();
    this.filteredCommands = this.commands.filter(c =>
      c.label.toLowerCase().includes(q)
    );
    this.selectedIndex = 0;
    this.renderResults();
  },

  renderResults() {
    this.results.innerHTML = this.filteredCommands.map((c, i) => `
      <div class="cmd-item ${i === this.selectedIndex ? 'selected' : ''}" data-index="${i}">
        <div class="d-flex align-items-center" style="pointer-events:none">
          <i class="fas ${c.icon}"></i>
          <span class="cmd-label">${c.label}</span>
        </div>
        <span class="cmd-shortcut" style="pointer-events:none">⏎</span>
      </div>
    `).join('');
  },

  execute(index) {
    const cmd = this.filteredCommands[index];
    if (cmd) cmd.action();
  }
};

document.addEventListener('DOMContentLoaded', () => CommandPalette.init());
