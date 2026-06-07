const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

/**
 * Level 3: Autonomous Website Auditing Crawler
 * Navigates to a URL, captures baseline/current screenshots, filters dynamic content,
 * and passes them to the Level 2 regression analyzer.
 */

async function runAutonomousAudit(baselineUrl, currentUrl, outputDir) {
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 }
    });

    const baselineScreenshotPath = path.join(outputDir, `baseline-${Date.now()}.png`);
    const currentScreenshotPath = path.join(outputDir, `current-${Date.now()}.png`);

    console.log(`[Level 3 Crawler] Navigating to Baseline URL: ${baselineUrl}`);
    const page1 = await context.newPage();
    await page1.goto(baselineUrl, { waitUntil: 'load', timeout: 30000 });
    await page1.waitForTimeout(2000); // Allow lazy-loaded elements to settle
    
    // Hide dynamic elements to prevent false positives (timestamps, ads, etc.)
    await hideDynamicElements(page1);
    await page1.screenshot({ path: baselineScreenshotPath, fullPage: true });
    await page1.close();

    console.log(`[Level 3 Crawler] Navigating to Current URL: ${currentUrl}`);
    const page2 = await context.newPage();
    await page2.goto(currentUrl, { waitUntil: 'load', timeout: 30000 });
    await page2.waitForTimeout(2000); // Allow lazy-loaded elements to settle
    
    await hideDynamicElements(page2);
    await page2.screenshot({ path: currentScreenshotPath, fullPage: true });
    await page2.close();

    return {
      baselinePath: baselineScreenshotPath,
      currentPath: currentScreenshotPath
    };
  } catch (error) {
    console.error("[Level 3 Crawler] Error during crawl:", error);
    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

async function hideDynamicElements(page) {
  // Inject CSS to hide common dynamic elements
  await page.addStyleTag({
    content: `
      iframe, video, [data-dynamic="true"], .ad, .advertisement, 
      time, .timestamp, .date-time, [id*="timestamp"] {
        visibility: hidden !important;
        opacity: 0 !important;
      }
    `
  });
  
  // Give page a moment to apply styles
  await page.waitForTimeout(500);
}

module.exports = { runAutonomousAudit };
