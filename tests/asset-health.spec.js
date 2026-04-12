const { test, expect } = require('@playwright/test');

/**
 * High-Fidelity Asset Health Seal (Anti-404)
 * Migrated to Playwright for unified CI/CD server lifecycle management.
 * Scans key pages for broken images and PDF certificates.
 */

const TARGET_PAGES = [
  '/',
  '/experience',
  '/certifications',
  '/honors-awards'
];

test.describe('Asset Integrity Seal (Anti-404)', () => {

  for (const pageUrl of TARGET_PAGES) {
    test(`Deep Health Sweep: ${pageUrl}`, async ({ page, request }) => {
      await page.goto(pageUrl, { waitUntil: 'networkidle' });

      // 1. Extract and Verify All Images
      const images = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('img'))
          .map(img => img.src)
          .filter(src => src && !src.startsWith('data:'));
      });

      console.log(`🔍 Found ${images.length} images on ${pageUrl}`);
      
      for (const src of images) {
        const response = await request.head(src);
        const status = response.status();
        
        // Allow 200 (OK) or 304 (Not Modified)
        if (status !== 200 && status !== 304) {
          console.error(`  ❌ [IMG] Failed (${status}): ${src}`);
        }
        expect([200, 304]).toContain(status);
      }

      // 2. Extract and Verify All PDF Documents
      const pdfs = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('[data-pdf]'))
          .map(el => el.getAttribute('data-pdf'))
          .filter(src => src);
      });

      console.log(`🔍 Found ${pdfs.length} PDF links on ${pageUrl}`);

      for (let src of pdfs) {
        // Resolve relative paths if necessary
        if (!src.startsWith('http')) {
          src = new URL(src, page.url()).href;
        }

        const response = await request.head(src);
        const status = response.status();

        if (status !== 200 && status !== 304) {
          console.error(`  ❌ [PDF] Failed (${status}): ${src}`);
        }
        expect([200, 304]).toContain(status);
      }
    });
  }
});
