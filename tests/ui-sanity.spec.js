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

    // Initial State (Default Light)
    await expect(html).not.toHaveAttribute('data-theme', 'dark');

    // Toggle to Dark
    await toggle.click();
    await expect(html).toHaveAttribute('data-theme', 'dark');

    // Toggle back to Light
    await toggle.click();
    await expect(html).not.toHaveAttribute('data-theme', 'dark');
  });

  test('Command Palette: Global Ctrl+K Trigger', async ({ page }) => {
    // Simulate Ctrl+K (Cmd+K)
    await page.keyboard.press('Control+k');
    
    const palette = page.locator('#cmdPaletteBackdrop');
    const input = page.locator('#cmdInput');
    
    await expect(palette).toHaveClass(/active/);
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

    // 2. Open Metrics (Should close Chatbot)
    await metricsToggle.click({ force: true });
    await expect(metricsDashboard).toHaveClass(/active/);
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

});
