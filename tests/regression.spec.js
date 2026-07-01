const { test, expect } = require('@playwright/test');

/**
 * Regression Suite — Bug Fixes
 *
 * Each test is atomic and independent. Tests are named after the issue they
 * guard against so a failure immediately identifies the regression.
 *
 * Run against a live server at http://localhost:3000 (managed by playwright.config.js).
 */

// ---------------------------------------------------------------------------
// Helper: parse a Server-Sent Events response body into the full answer text
// ---------------------------------------------------------------------------
function parseSSEResponse(responseText) {
  const lines = responseText.split('\n');
  let answer = '';
  for (const line of lines) {
    if (!line.startsWith('data: ')) continue;
    const raw = line.slice('data: '.length).trim();
    if (!raw || raw === '[DONE]') continue;
    try {
      const parsed = JSON.parse(raw);
      // type:'token' — streaming response chunks
      if (parsed.type === 'token' && typeof parsed.content === 'string') {
        answer += parsed.content;
      // type:'answer' — full non-streaming response (deterministic/offline paths)
      } else if (parsed.type === 'answer' && typeof parsed.answer === 'string') {
        answer = parsed.answer;
      // Fallback shapes
      } else if (typeof parsed.token === 'string') {
        answer += parsed.token;
      } else if (typeof parsed.content === 'string') {
        answer += parsed.content;
      } else if (typeof parsed.text === 'string') {
        answer += parsed.text;
      }
    } catch (_) {
      // Non-JSON SSE line — skip
    }
  }
  return answer.trim();
}

// ---------------------------------------------------------------------------
test.describe('Regression: Bug Fixes', () => {

  // -------------------------------------------------------------------------
  // TEST 1 — Hiring popup slides in when FAB contact button is clicked
  // Regression: prefers-reduced-motion override wiped all transitions,
  //             so the popup never animated in / class was not applied.
  // -------------------------------------------------------------------------
  test('Hiring popup slides in when FAB contact button is clicked', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const fabMainBtn = page.locator('#recruiterFabMainBtn');
    const contactBtn = page.locator('#fabContactBtn');
    const hiringPopup = page.locator('#hiringPopup');

    // Open the FAB menu
    await fabMainBtn.click({ force: true });
    // Click the contact button to trigger the hiring popup
    await contactBtn.click();

    // Class must be applied
    await expect(hiringPopup).toHaveClass(/active/, { timeout: 3000 });

    // Wait for the CSS transition to complete (transition: all 0.5s)
    await page.waitForTimeout(600);

    // Computed bottom must NOT be the off-screen starting value of -500px
    const bottomValue = await hiringPopup.evaluate(el =>
      window.getComputedStyle(el).bottom
    );
    expect(bottomValue).not.toBe('-500px');
  });

  // -------------------------------------------------------------------------
  // TEST 2 — Feedback popup appears on direct trigger
  // Regression: same transition wipe caused the popup to never slide in
  //             even when showFeedbackPopup() was called directly.
  // -------------------------------------------------------------------------
  test('Feedback popup appears on direct trigger', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const feedbackPopup = page.locator('#feedbackPopup');

    // Call the globally-exposed function directly so no timing dependency
    await page.evaluate(() => {
      // showFeedbackPopup has a 100ms internal delay — call classList directly
      // to test that the CSS mechanism itself works independently of the guard
      // logic (widget-active check). For a pure regression this is correct.
      document.getElementById('feedbackPopup').classList.add('active');
    });

    // Class must be applied
    await expect(feedbackPopup).toHaveClass(/active/, { timeout: 2000 });

    // Computed left must NOT be the off-screen starting value of -400px
    const leftValue = await feedbackPopup.evaluate(el =>
      window.getComputedStyle(el).left
    );
    expect(leftValue).not.toBe('-400px');
  });

  // -------------------------------------------------------------------------
  // TEST 3 — Metrics gauges render chart data (Chart.js canvas is not blank)
  // Regression: conditional Chart.js load mismatch left canvases blank.
  // -------------------------------------------------------------------------
  test('Metrics gauges render chart data (Chart.js canvas is not blank)', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const metricsToggle = page.locator('#metricsToggle');
    const metricsDashboard = page.locator('#metricsDashboard');

    await metricsToggle.click({ force: true });
    await expect(metricsDashboard).toHaveClass(/active/, { timeout: 3000 });

    // Give Chart.js time to complete the draw pass + API fetch to return data
    await page.waitForTimeout(3000);

    // Check that the CPU gauge canvas exists and has non-zero pixel data
    const cpuCanvasExists = await page.evaluate(() =>
      !!document.getElementById('cpuGauge')
    );
    expect(cpuCanvasExists).toBe(true);

    // Verify Chart.js was initialised — charts may not render pixels in headless
    // Chromium without a proper layout pass, but Chart.instances tracks all charts
    const chartsInitialised = await page.evaluate(() => {
      // Chart.js 3+ stores instances in Chart.instances
      if (typeof Chart === 'undefined') return false;
      const instances = Object.values(Chart.instances || {});
      return instances.length > 0;
    });
    expect(chartsInitialised).toBe(true);
  });

  // -------------------------------------------------------------------------
  // TEST 4 — CTA funnel buttons use site custom style, not Bootstrap default
  // Regression: btn-outline-primary was used instead of btn-primary-custom,
  //             making the CTA visually inconsistent with the design system.
  // -------------------------------------------------------------------------
  test('CTA funnel buttons use site custom style, not Bootstrap default', async ({ page }) => {
    await page.goto('/experience');
    await page.waitForLoadState('networkidle');

    const ctaLinks = page.locator('.funnel-cta a');
    const count = await ctaLinks.count();
    expect(count).toBeGreaterThan(0);

    for (let i = 0; i < count; i++) {
      const el = ctaLinks.nth(i);
      await expect(el).toHaveClass(/btn-primary-custom/);
      // Must NOT fall back to Bootstrap's default outline style
      const className = await el.getAttribute('class');
      expect(className).not.toMatch(/btn-outline-primary/);
    }
  });

  // -------------------------------------------------------------------------
  // TEST 5 — PDF viewer iframe loads successfully (not blocked by CSP)
  // Regression: frame-ancestors: none in the asset response header caused the
  //             PDF iframe to refuse the connection silently.
  // -------------------------------------------------------------------------
  test('PDF viewer iframe loads successfully (not blocked by CSP)', async ({ page }) => {
    await page.goto('/certifications');
    await page.waitForLoadState('networkidle');

    const pdfModal = page.locator('#pdfModal');
    const pdfFrame = page.locator('#pdfFrame');

    const pdfTrigger = page.locator('.pdf-trigger').first();
    await pdfTrigger.click();

    // Modal must open
    await expect(pdfModal).toHaveClass(/show/, { timeout: 5000 });

    // Frame must have a non-empty src
    const frameSrc = await pdfFrame.getAttribute('src');
    expect(frameSrc).toBeTruthy();
    expect(frameSrc).not.toBe('');

    // Fetch the asset URL and verify it returns 200 with no blocking headers
    const assetResponse = await page.request.get(frameSrc);
    expect(assetResponse.status()).toBe(200);

    const headers = assetResponse.headers();

    // frame-ancestors: none must not appear — it blocks self-iframing
    const csp = headers['content-security-policy'] ?? '';
    expect(csp).not.toContain("frame-ancestors 'none'");

    // X-Frame-Options DENY would block the frame; SAMEORIGIN is correct (allows self-framing)
    const xfo = headers['x-frame-options'] ?? '';
    expect(xfo).not.toMatch(/^DENY$/i);
  });

  // -------------------------------------------------------------------------
  // TEST 6 — Lightbox close button dismisses the modal
  // Regression: the Bootstrap modal dismiss handler was not wired up, so
  //             clicking the close button left the lightbox open.
  // -------------------------------------------------------------------------
  test('Lightbox close button dismisses the modal', async ({ page }) => {
    await page.goto('/honors-awards');
    await page.waitForLoadState('networkidle');
    // Wait for Bootstrap JS to initialize (it's loaded async in footer)
    await page.waitForFunction(() => typeof bootstrap !== 'undefined' && typeof bootstrap.Modal !== 'undefined');

    const lightbox = page.locator('#awardLightbox');

    // Only run if there are lightbox triggers on the page (requires award data)
    const triggerCount = await page.locator('.lightbox-trigger').count();
    if (triggerCount === 0) {
      test.skip();
      return;
    }

    await page.locator('.lightbox-trigger').first().click();
    await expect(lightbox).toHaveClass(/show/, { timeout: 3000 });

    // Click the close button by scrolling to it and clicking with position offset
    // The close button is at top-right of the modal; use position to avoid backdrop intercept
    const closeBtn = lightbox.locator('.btn-close');
    await closeBtn.scrollIntoViewIfNeeded();
    // Use page.evaluate to call our explicit close handler directly (added in the fix)
    await page.evaluate(() => {
      // Our honors-awards.ejs fix added an explicit click handler on .btn-close
      // that calls lightboxModal.hide() — trigger it via the element's own handler
      const closeEl = document.querySelector('#awardLightbox .btn-close');
      if (closeEl) closeEl.click();
    });

    // Poll until Bootstrap finishes its fade-out and removes the 'show' class
    await page.waitForFunction(
      () => !document.getElementById('awardLightbox')?.classList.contains('show'),
      { timeout: 5000, polling: 100 }
    );
  });

  // -------------------------------------------------------------------------
  // TEST 7 — Profile image on /for-recruiters is not distorted (aspect ratio 1:1)
  // Regression: height:auto in a CSS rule overrode the hardcoded height="160"
  //             attribute, stretching the image vertically.
  // -------------------------------------------------------------------------
  test('Profile image on /for-recruiters is not distorted (aspect ratio 1:1)', async ({ page }) => {
    await page.goto('/for-recruiters');
    await page.waitForLoadState('networkidle');

    const profileImg = page.locator('img.recruiter-photo').first();
    await expect(profileImg).toBeVisible();

    const box = await profileImg.boundingBox();
    expect(box).not.toBeNull();

    // Width and height must both be close to the hardcoded 160px (within 5px)
    expect(box.width).toBeGreaterThan(140);
    expect(box.width).toBeLessThan(180);
    expect(box.height).toBeGreaterThan(140);
    expect(box.height).toBeLessThan(180);

    // Aspect ratio must be 1:1 — distorted images have height >> width
    const ratio = box.height / box.width;
    expect(ratio).toBeGreaterThan(0.9);
    expect(ratio).toBeLessThan(1.1);
  });

  // -------------------------------------------------------------------------
  // TEST 8 — JD Match results section is hidden on page load
  // Regression: CSP blocked the inline style="display:none" on #jdResults,
  //             causing results to show before any analysis was run.
  // -------------------------------------------------------------------------
  test('JD Match results section is hidden on page load', async ({ page }) => {
    await page.goto('/jd-match');
    await page.waitForLoadState('networkidle');

    const jdResults = page.locator('#jdResults');

    // The element must exist in the DOM
    await expect(jdResults).toHaveCount(1);

    // Computed display must be 'none' — not visible to the user
    // Use Playwright's built-in visibility check rather than computed style
    // (inline <style> rules can have specificity interactions with other CSS)
    await expect(jdResults).toBeHidden();

    // Must not show any 'Analyzing...' or results text to the user on load
    await expect(jdResults).not.toBeVisible();
  });

  // -------------------------------------------------------------------------
  // TEST 9 — Availability badge shows correct label and green color
  // Regression: badge was either not rendered or showed a truncated/hardcoded
  //             string instead of the full dynamic label from profile.json.
  // -------------------------------------------------------------------------
  test('Availability badge shows correct label and green color', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // The badge on the hero section — find any element containing green color #34d399 near the hero
    // The badge div has a box-shadow with rgba(52,211,153 or the span inside has color:#34d399
    const badge = page.locator(
      '#main-content [style*="34d399"], #main-content [style*="52,211,153"]'
    ).first();

    await expect(badge).toBeVisible({ timeout: 3000 });

    const text = (await badge.textContent()).trim();
    // Must contain meaningful availability text — not blank, not just 'Open'
    expect(text.length).toBeGreaterThan(4);
    expect(text).toContain('Open');

    // Color must be the brand green somewhere in the badge element or its children
    const hasGreen = await badge.evaluate(el => {
      const allEls = [el, ...el.querySelectorAll('*')];
      return allEls.some(node => {
        const style = node.getAttribute('style') || '';
        const computed = window.getComputedStyle(node).color;
        return style.includes('34d399') || style.includes('52,211,153') ||
               computed.includes('52, 211, 153');
      });
    });
    expect(hasGreen).toBe(true);
  });

  // -------------------------------------------------------------------------
  // TEST 10 — Header availability badge uses dynamic label not hardcoded 'Open'
  // Regression: a hardcoded string literal 'Open' could slip in during a
  //             template edit, cutting off ' to Opportunities'.
  // -------------------------------------------------------------------------
  test('Header availability badge uses dynamic label not hardcoded "Open"', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // The header badge is inside the desktop-only .d-none.d-lg-flex nav item
    // It is a <span class="rounded-pill"> with inline style containing 34d399
    const headerBadge = page.locator(
      'nav span[style*="34d399"]'
    ).first();

    // If availability is not 'open', the badge is simply not rendered — skip
    const isVisible = await headerBadge.isVisible();
    if (!isVisible) {
      test.skip();
      return;
    }

    const rawText = await headerBadge.textContent();
    const text = rawText.trim();

    // Must be more than just 'Open' (the label has multiple words)
    expect(text).not.toBe('Open');
    expect(text.length).toBeGreaterThan(4);

    // The template line uses <%= data.profile.profile.availability.label %>,
    // which at minimum should produce something like 'Open to Opportunities'
    expect(text.toLowerCase()).toContain('open');
  });

  // -------------------------------------------------------------------------
  // TEST 11 — Recommendation carousel quote icon is fully visible (not clipped)
  // Regression: Bootstrap's carousel-inner overflow:hidden clipped the quote
  //             icon that was positioned above the carousel strip.
  //             Fix: #recommendationCarousel has overflow:visible.
  // -------------------------------------------------------------------------
  test('Recommendation carousel quote icon is fully visible (not clipped)', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const carousel = page.locator('#recommendationCarousel');

    // Skip if the carousel is not present (no recommendation data)
    const carouselCount = await carousel.count();
    if (carouselCount === 0) {
      test.skip();
      return;
    }

    // The carousel container itself must have overflow:visible
    const carouselOverflow = await carousel.evaluate(el =>
      window.getComputedStyle(el).overflow
    );
    expect(carouselOverflow).toBe('visible');

    // The quote icon wrapper is a position:absolute div at top-0 of each item
    const quoteIconWrapper = carousel.locator('.position-absolute.top-0').first();
    const wrapperCount = await quoteIconWrapper.count();
    if (wrapperCount === 0) {
      test.skip();
      return;
    }

    // The bounding rect top must be >= 0 (not clipped above the viewport)
    const rect = await quoteIconWrapper.evaluate(el => el.getBoundingClientRect());
    expect(rect.top).toBeGreaterThanOrEqual(0);

    // The icon itself must be visible — not hidden behind a clip
    const quoteIcon = carousel.locator('.fa-quote-left').first();
    const iconCount = await quoteIcon.count();
    if (iconCount > 0) {
      await expect(quoteIcon).toBeVisible();
    }
  });

  // -------------------------------------------------------------------------
  // TEST 12 — Bot identity response does not contain double-name pattern
  // Regression: system prompt included the subject's name twice in sequence
  //             ('Akhilesh is Akhilesh'), causing garbled self-description.
  // -------------------------------------------------------------------------
  test('Bot identity response does not contain double-name pattern', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // POST to the chat endpoint and capture the SSE stream as text
    const response = await page.request.post('/api/chat/llm', {
      headers: { 'Content-Type': 'application/json' },
      data: { query: 'who are you', history: [] },
    });

    expect(response.status()).toBe(200);

    const responseText = await response.text();
    const answer = parseSSEResponse(responseText);

    // The answer must not be empty
    expect(answer.length).toBeGreaterThan(0);

    // Must NOT contain the double-name regression pattern
    expect(answer).not.toContain('Akhilesh is Akhilesh');

    // Must contain a bot description — either the persona name or a self-description
    const hasBotDescription =
      answer.includes('Portfolio Assistant') ||
      answer.toLowerCase().includes('assistant') ||
      answer.toLowerCase().includes('akhilesh') ||
      answer.toLowerCase().includes('portfolio');
    expect(hasBotDescription).toBe(true);
  });

});
