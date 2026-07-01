/**
 * Akhilesh Angadi Portfolio — Global Footer Initializer
 *
 * Extracted from footer.ejs inline <script> block.
 * Handles: AOS init, single merged scroll handler (progress + navbar), theme toggle.
 *
 * Author: Akhilesh Angadi
 */
document.addEventListener('DOMContentLoaded', () => {

  // AOS
  if (typeof AOS !== 'undefined') {
    AOS.init({ duration: 800, once: true, offset: 100, easing: 'ease-out-cubic' });
  }

  // Single merged scroll handler — replaces two separate window.addEventListener('scroll') bindings
  // Uses requestAnimationFrame to coalesce rapid scroll events into one DOM update per frame
  let _scrollTicking = false;
  const scrollProgress = document.getElementById('scroll-progress');
  const navbar         = document.getElementById('main-nav');

  window.addEventListener('scroll', () => {
    if (_scrollTicking) return;
    _scrollTicking = true;
    requestAnimationFrame(() => {
      const scrollY  = window.scrollY || document.documentElement.scrollTop || document.body.scrollTop;
      const docH     = document.documentElement.scrollHeight - document.documentElement.clientHeight;

      if (scrollProgress) {
        const pct = docH > 0 ? Math.min(100, Math.max(0, (scrollY / docH) * 100)) : 0;
        scrollProgress.style.width = pct + '%';
      }

      if (navbar) {
        navbar.classList.toggle('scrolled', scrollY > 50);
      }

      _scrollTicking = false;
    });
  }, { passive: true });

  // Theme toggle
  const themeToggle = document.getElementById('theme-toggle');
  if (themeToggle) {
    const icon = themeToggle.querySelector('i');

    const currentTheme = localStorage.getItem('theme') || 'dark';
    if (currentTheme === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
      if (icon) icon.classList.replace('fa-moon', 'fa-sun');
    }

    themeToggle.addEventListener('click', () => {
      const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
      if (isDark) {
        document.documentElement.removeAttribute('data-theme');
        localStorage.setItem('theme', 'light');
        if (icon) icon.classList.replace('fa-sun', 'fa-moon');
      } else {
        document.documentElement.setAttribute('data-theme', 'dark');
        localStorage.setItem('theme', 'dark');
        if (icon) icon.classList.replace('fa-moon', 'fa-sun');
      }
    });
  }

});
