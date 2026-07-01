const { test, expect } = require('@playwright/test');

/**
 * UI Sanity Suite (Staff+ v1)
 * Higher-fidelity real-browser sweep of premium interactive features.
 * Fully compatible with CI/CD headless environments.
 */

test.describe('Premium UI Features Sweep', () => {
  
  test.beforeEach(async ({ page }) => {
    // Navigate to the base URL (automatically managed by playwright.config.js)
    await page.goto('/');
    // Wait for the DOM and hydration
    await page.waitForLoadState('domcontentloaded');
  });

  test('Navbar & Branding: Correct Identity', async ({ page }) => {
    const brand = page.locator('.navbar-brand');
    await expect(brand).toBeVisible();
    await expect(brand).toContainText('Akhilesh');
  });

  test('Theme Toggling: High-Aesthetic Switch', async ({ page }) => {
    const toggle = page.locator('#theme-toggle');
    const html = page.locator('html');

    // Initial State — default is dark (set in head.ejs theme-flash script)
    await expect(html).toHaveAttribute('data-theme', 'dark');

    // Toggle to Light
    await toggle.click();
    await expect(html).not.toHaveAttribute('data-theme', 'dark');

    // Toggle back to Dark
    await toggle.click();
    await expect(html).toHaveAttribute('data-theme', 'dark');
  });

  test('Command Palette: Global Ctrl+K Trigger', async ({ page }) => {
    // Simulate Ctrl+K (Cmd+K)
    await page.keyboard.press('Control+k');

    const palette = page.locator('#cmdPaletteBackdrop');
    const input = page.locator('#cmdInput');

    await expect(palette).toHaveClass(/active/);
    // Input focus uses a 50ms setTimeout internally — wait for it
    await page.waitForTimeout(200);
    await expect(input).toBeFocused();

    // Close with Escape
    await page.keyboard.press('Escape');
    await expect(palette).not.toHaveClass(/active/);
  });

  test('Floating Widgets: Mutual Exclusion (UIManager)', async ({ page }) => {
    const chatToggle = page.locator('#chatToggle');
    const chatWindow = page.locator('#chatWindow');
    const metricsToggle = page.locator('#metricsToggle');
    const metricsDashboard = page.locator('#metricsDashboard');

    // 1. Open Chatbot
    await chatToggle.click({ force: true });
    await expect(chatWindow).toHaveClass(/active/);

    // 2. Open Metrics (UIManager closes Chatbot first, then toggles Metrics)
    await metricsToggle.click({ force: true });
    // Allow time for UIManager.closeAll + CSS transition
    await page.waitForTimeout(500);
    await expect(metricsDashboard).toHaveClass(/active/, { timeout: 3000 });
    await expect(chatWindow).not.toHaveClass(/active/);

    // 3. Close with Escape
    await page.keyboard.press('Escape');
    await expect(metricsDashboard).not.toHaveClass(/active/);
  });

  test('Recruiter FAB: Magnetism & Menu', async ({ page }) => {
    const fabBtn = page.locator('#recruiterFabMainBtn');
    const fabContainer = page.locator('#recruiterFab');
    const whyBtn = page.locator('#fabWhyBtn');

    // Open FAB
    await fabBtn.click();
    await expect(fabContainer).toHaveClass(/active/);
    await expect(whyBtn).toBeVisible();

    // Close by clicking outside
    await page.mouse.click(10, 10);
    await expect(fabContainer).not.toHaveClass(/active/);
  });

  test('Health Status: Real-time Metrics Dashboard', async ({ page }) => {
    const toggle = page.locator('#metricsToggle');
    const dashboard = page.locator('#metricsDashboard');
    
    await toggle.click({ force: true });
    await expect(dashboard).toHaveClass(/active/);
    
    // Check for some core metrics elements
    const uptime = dashboard.locator('.metric-value').first(); 
    await expect(uptime).toBeVisible();
  });

  test('PDF Viewer: Certificate Accessibility', async ({ page }) => {
    // Navigate to local certifications page for a guaranteed trigger
    await page.goto('/certifications');
    const pdfTrigger = page.locator('.pdf-trigger').first();
    const pdfModal = page.locator('#pdfModal');
    const pdfFrame = page.locator('#pdfFrame');

    await pdfTrigger.click();
    await expect(pdfModal).toHaveClass(/show/); // Bootstrap 'show' class
    await expect(pdfFrame).toHaveAttribute('src', /.*\.pdf/);
  });

  test('Hiring Popup: Recruiter Engagement Loop', async ({ page }) => {
    const fabBtn = page.locator('#recruiterFabMainBtn');
    const contactBtn = page.locator('#fabContactBtn');
    const hiringPopup = page.locator('#hiringPopup');

    await fabBtn.click({ force: true });
    await contactBtn.click();
    await expect(hiringPopup).toHaveClass(/active/);
    await expect(hiringPopup.locator('input').first()).toBeVisible();
  });

  test('Mobile Responsiveness: Hamburger Navigation', async ({ page }) => {
    // 1. Set viewport to mobile size BEFORE navigation for native rendering
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/', { waitUntil: 'networkidle' });

    const toggler = page.locator('.navbar-toggler');
    const navCollapse = page.locator('#navbarNav');

    await expect(toggler).toBeVisible();

    // 2. Trigger click via evaluate to ensure event listener is reached directly
    await page.evaluate(() => {
      const btn = document.querySelector('.navbar-toggler');
      if (btn) btn.click();
    });

    // 3. Robust wait for Bootstrap transition to 'show'
    await expect(navCollapse).toHaveClass(/show/, { timeout: 10000 });
    await expect(navCollapse).toBeVisible();
  });

  test('Responsive 320px: no horizontal scroll on homepage', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 2);
  });

  test('Responsive 2560px: container width is capped below full viewport', async ({ page }) => {
    await page.setViewportSize({ width: 2560, height: 1440 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const containerWidth = await page.evaluate(() => {
      const el = document.querySelector('.container');
      return el ? el.getBoundingClientRect().width : 2560;
    });
    expect(containerWidth).toBeLessThan(2000);
  });

  test('CSP header is present on all routes', async ({ page }) => {
    const routes = ['/', '/experience', '/my-skills', '/for-recruiters', '/jd-match'];
    for (const route of routes) {
      const response = await page.goto(route);
      const csp = response.headers()['content-security-policy'];
      expect(csp, `CSP missing on ${route}`).toBeTruthy();
      expect(csp).toContain('script-src');
      // script-src must NOT use unsafe-inline — nonce-based for scripts
      const scriptSrc = csp.split(';').find(d => d.trim().startsWith('script-src')) || '';
      expect(scriptSrc, `unsafe-inline found in script-src on ${route}`).not.toContain("'unsafe-inline'");
      // style-src must allow inline styles (needed for style="" attributes throughout the app)
      const styleSrc = csp.split(';').find(d => d.trim().startsWith('style-src')) || '';
      expect(styleSrc, `style-src missing on ${route}`).toBeTruthy();
    }
  });

});
