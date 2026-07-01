/**
 * Toast Notification System
 * Replaces all alert() calls across the app with accessible, dismissible toasts.
 *
 * API:
 *   Toast.show({ message, type, duration })
 *   Toast.clear()
 *
 * Types: 'success' | 'error' | 'warning' | 'info'
 */
(function () {
  'use strict';

  const ICONS = {
    success: 'fa-check-circle',
    error:   'fa-exclamation-circle',
    warning: 'fa-exclamation-triangle',
    info:    'fa-info-circle',
  };

  let container = null;

  function _getContainer() {
    if (container) return container;
    container = document.createElement('div');
    container.id = 'toast-root';
    container.setAttribute('aria-live', 'polite');
    container.setAttribute('aria-atomic', 'false');
    document.body.appendChild(container);
    return container;
  }

  function _esc(str) {
    const d = document.createElement('div');
    d.textContent = String(str);
    return d.innerHTML;
  }

  function _dismiss(el) {
    el.classList.add('toast--out');
    el.addEventListener('animationend', () => el.remove(), { once: true });
  }

  const Toast = {
    show({ message, type = 'info', duration }) {
      const c = _getContainer();
      const defaultDuration = type === 'error' ? 6000 : 3500;
      const ms = duration !== undefined ? duration : defaultDuration;

      const el = document.createElement('div');
      el.className = `toast toast--${type}`;
      // Errors demand immediate attention; others are polite notifications
      el.setAttribute('role', type === 'error' ? 'alert' : 'status');

      el.innerHTML = `
        <div class="toast__body">
          <i class="fas ${ICONS[type] || ICONS.info} toast__icon" aria-hidden="true"></i>
          <span class="toast__msg">${_esc(message)}</span>
        </div>
        <button class="toast__close" type="button" aria-label="Dismiss notification">
          <i class="fas fa-times" aria-hidden="true"></i>
        </button>`;

      el.querySelector('.toast__close').addEventListener('click', () => _dismiss(el));

      // Pause auto-dismiss on hover so user can read long messages
      let tid;
      const schedule = () => { if (ms > 0) tid = setTimeout(() => _dismiss(el), ms); };
      el.addEventListener('mouseenter', () => clearTimeout(tid));
      el.addEventListener('mouseleave', schedule);

      c.appendChild(el);
      schedule();
    },

    clear() {
      if (container) container.innerHTML = '';
    },
  };

  // Expose globally
  window.Toast = Toast;
}());
