import { chromium } from '@playwright/test';

async function takeScreenshot() {
  // Launch with GPU enabled for WebGL support
  const browser = await chromium.launch({
    headless: false,
    args: [
      '--use-gl=angle',
      '--use-angle=default',
      '--enable-webgl',
      '--ignore-gpu-blocklist'
    ]
  });

  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log(`Browser error: ${msg.text()}`);
    }
  });

  page.on('pageerror', error => {
    console.log(`Page error: ${error.message}`);
  });

  // Get target URL from command line args, default to home
  const targetPath = process.argv[2] || '/';
  const url = `http://localhost:5180${targetPath}`;

  // Clear localStorage to get default dark mode
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    localStorage.removeItem('theme');
  });
  // Reload to apply default dark theme
  await page.reload({ waitUntil: 'networkidle' });

  // Wait for page to render
  await page.waitForTimeout(2000);

  // Take screenshot
  const filename = process.argv[3] || 'screenshot.png';
  await page.screenshot({ path: filename, fullPage: true });

  console.log(`Screenshot saved to ${filename}`);

  await browser.close();
}

takeScreenshot().catch(console.error);
